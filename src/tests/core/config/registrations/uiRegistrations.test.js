// src/tests/core/config/registrations/uiRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */
// ADDED for LocationRenderer test dependencies
/** @typedef {import('../../../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../../core/interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
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
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

// ADDED: Mocks for new dependencies needed by LocationRenderer in its test
const mockEntityManagerService = {
    getEntityInstance: jest.fn(),
    // Add any other IEntityManager methods if LocationRenderer starts using them
};
const mockDataRegistryService = {
    getEntityDefinition: jest.fn(),
    // Add any other IDataRegistry methods if LocationRenderer starts using them
};


// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument;
let mockOutputDiv;
let mockTitleElement;
let mockGameContainer;
let mockActionButtonsContainer;
let mockLocationInfoContainer;
let mockInventoryWidget;
let mockPlayerConfirmTurnButton;


const setupDomMocks = () => {
    mockDocument = document; // Use jsdom document
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1');
    mockGameContainer = mockDocument.createElement('div');
    mockActionButtonsContainer = mockDocument.createElement('div');
    mockLocationInfoContainer = mockDocument.createElement('div');
    mockInventoryWidget = mockDocument.createElement('div');
    mockPlayerConfirmTurnButton = mockDocument.createElement('button');


    mockInputElement.id = 'input-element';
    mockOutputDiv.id = 'output-div';
    mockTitleElement.id = 'title-element';
    mockGameContainer.id = 'game-container';
    mockActionButtonsContainer.id = 'action-buttons';
    mockLocationInfoContainer.id = 'location-info-container';
    mockInventoryWidget.id = 'inventory-widget';
    mockPlayerConfirmTurnButton.id = 'player-confirm-turn-button';


    mockDocument.body.innerHTML = '';
    mockDocument.body.appendChild(mockGameContainer);
    mockGameContainer.appendChild(mockOutputDiv);
    mockDocument.body.appendChild(mockActionButtonsContainer);
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement);
    mockDocument.body.appendChild(mockLocationInfoContainer);
    mockDocument.body.appendChild(mockInventoryWidget);
    mockDocument.body.appendChild(mockPlayerConfirmTurnButton);


    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    jest.spyOn(mockDocument, 'querySelector');
    jest.spyOn(mockDocument, 'getElementById');
    jest.spyOn(mockDocument, 'createElement');
    jest.spyOn(mockDocument.body, 'appendChild');
};


// --- Mock Custom DI Container (Pure JS Version) ---
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

            const isClassForSingle = typeof factoryOrValue === 'function'
                && options?.dependencies
                && Array.isArray(options.dependencies)
                && options?.lifecycle === 'singleton';
            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle;

            if (isClassForSingle) {
                const ClassConstructor = factoryOrValue;
                const depsMap = {};
                options.dependencies.forEach(depToken => {
                    let propName = String(depToken);
                    if (propName.startsWith('I') && propName.length > 1 && propName[1] === propName[1].toUpperCase()) {
                        propName = propName.substring(1);
                    }
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                    try {
                        depsMap[propName] = containerInstance.resolve(depToken);
                    } catch (resolveError) {
                        console.error(`[Mock Resolve - isClassForSingle] Failed to resolve dependency '${String(depToken)}' for '${ClassConstructor.name}'`);
                        throw resolveError;
                    }
                });
                try {
                    instance = new ClassConstructor(depsMap);
                } catch (constructorError) {
                    console.error(`[Mock Resolve - isClassForSingle] Error constructing '${ClassConstructor.name}' with deps:`, depsMap, constructorError);
                    throw constructorError;
                }
            } else if (isFactoryFunction) {
                try {
                    instance = factoryOrValue(containerInstance);
                } catch (factoryError) {
                    console.error(`[Mock Resolve - Factory] Error executing factory for token ${tokenString}:`, factoryError);
                    throw factoryError;
                }
            } else {
                instance = factoryOrValue;
            }

            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        if (token === tokens.EventBus) return mockEventBus;

        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    containerInstance = {
        _registrations: registrations, _instances: instances,
        register: registerSpy, resolve: resolveSpy,
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

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});

        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) document.body.innerHTML = '';
    });

    it('should register essential external dependencies (document, elements) as singleton instances', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WindowDocument, mockDocument, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, expect.objectContaining({lifecycle: 'singleton'}));
    });

    it('should register IDocumentContext via singletonFactory resolving to DocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        mockContainer.resolve(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        mockContainer.resolve(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
    });

    it('should register UiMessageRenderer using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.UiMessageRenderer);
        expect(instance).toBeInstanceOf(UiMessageRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('should register TitleRenderer via singletonFactory injecting titleElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.TitleRenderer);
        expect(instance).toBeInstanceOf(TitleRenderer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement);
    });

    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.InputStateController);
        expect(instance).toBeInstanceOf(InputStateController);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
    });

    it('should register LocationRenderer via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs); // This registers the factory for LocationRenderer

        // Prepare mocks for all dependencies LocationRenderer's factory will resolve
        const docContextInstance = new DocumentContext(mockDocument);
        const domFactoryInstance = new DomElementFactory(docContextInstance); // LocationRenderer needs this
        const querySpy = jest.spyOn(docContextInstance, 'query').mockReturnValue(mockLocationInfoContainer);

        // Save the original mockContainer.resolve
        const originalResolve = mockContainer.resolve;

        // Override mockContainer.resolve specifically for this test's factory execution
        mockContainer.resolve = jest.fn(token => {
            // Handle dependencies needed by LocationRenderer constructor and its base class (RendererBase)
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return domFactoryInstance;
            if (token === tokens.IEntityManager) return mockEntityManagerService; // Provide mock
            if (token === tokens.IDataRegistry) return mockDataRegistryService;   // Provide mock

            // Fallback for resolving LocationRenderer token itself or other unhandled tokens
            if (token === tokens.LocationRenderer) {
                // If LocationRenderer is requested, it means its factory needs to be executed.
                // The factory was registered by registerUI() call above.
                // We retrieve it from our mock container's registrations and execute it,
                // passing the current (specially mocked) container instance.
                const registration = mockContainer._registrations.get(tokens.LocationRenderer);
                if (registration && typeof registration.factoryOrValue === 'function') {
                    return registration.factoryOrValue(mockContainer);
                }
            }
            return originalResolve(token); // Use original for any other token
        });

        // Trigger the factory execution for LocationRenderer
        const instance = mockContainer.resolve(tokens.LocationRenderer);

        expect(instance).toBeInstanceOf(LocationRenderer);
        expect(querySpy).toHaveBeenCalledWith('#location-info-container');
        // Ensure logger.warn wasn't called for missing container
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Could not find '#location-info-container' element for LocationRenderer")
        );

        // Check that the new dependencies were "resolved" (i.e., our mock was called for them)
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory); // verify this too

        // Restore the original mockContainer.resolve
        mockContainer.resolve = originalResolve;
    });

    it('should register InventoryPanel via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs);
        const docContextInstance = new DocumentContext(mockDocument);
        const querySpy = jest.spyOn(docContextInstance, 'query').mockReturnValue(mockInventoryWidget);
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return new DomElementFactory(docContextInstance);
            if (token === tokens.InventoryPanel) {
                const registration = mockContainer._registrations.get(tokens.InventoryPanel);
                if (registration && typeof registration.factoryOrValue === 'function') {
                    return registration.factoryOrValue(mockContainer);
                }
            }
            return originalResolve(token);
        });

        const instance = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance).toBeInstanceOf(InventoryPanel);
        expect(querySpy).toHaveBeenCalledWith('#inventory-widget');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('InventoryPanel'));
        mockContainer.resolve = originalResolve;
    });

    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs);

        const docContextInstance = new DocumentContext(mockDocument);
        const domFactoryInstance = new DomElementFactory(docContextInstance);
        const querySpy = jest.spyOn(docContextInstance, 'query');
        querySpy.mockImplementation(selector => {
            if (selector === '#action-buttons') return mockActionButtonsContainer;
            if (selector === '#player-confirm-turn-button') return mockPlayerConfirmTurnButton;
            return null;
        });

        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return domFactoryInstance;
            if (token === tokens.ActionButtonsRenderer) {
                const registration = mockContainer._registrations.get(tokens.ActionButtonsRenderer);
                if (registration && typeof registration.factoryOrValue === 'function') {
                    return registration.factoryOrValue(mockContainer);
                }
            }
            return originalResolve(token);
        });

        const instance1 = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance1).toBeInstanceOf(ActionButtonsRenderer);
        expect(querySpy).toHaveBeenCalledWith('#action-buttons');
        expect(querySpy).toHaveBeenCalledWith('#player-confirm-turn-button');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("[ActionButtonsRenderer] 'sendButtonElement' (Confirm Action button) was not provided")
        );
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#action-buttons' element for ActionButtonsRenderer"));
        mockContainer.resolve = originalResolve;
    });

    it('should register DomUiFacade under its own token using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomUiFacade);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toBe(DomUiFacade);
        expect(regCall[2]).toEqual(expect.objectContaining({
            lifecycle: 'singleton',
            dependencies: [
                tokens.ActionButtonsRenderer, tokens.InventoryPanel, tokens.LocationRenderer,
                tokens.TitleRenderer, tokens.InputStateController, tokens.UiMessageRenderer
            ]
        }));
    });

    it('should register IInputHandler via singletonFactory with IValidatedEventDispatcher', () => {
        registerUI(mockContainer, mockUiArgs);
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.inputElement) return mockInputElement;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.IInputHandler) {
                const registration = mockContainer._registrations.get(tokens.IInputHandler);
                if (registration && typeof registration.factoryOrValue === 'function') {
                    return registration.factoryOrValue(mockContainer);
                }
            }
            return originalResolve(token);
        });

        const instance1 = mockContainer.resolve(tokens.IInputHandler);
        expect(instance1).toBeInstanceOf(InputHandler);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        mockContainer.resolve = originalResolve;
    });

    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
    });
});