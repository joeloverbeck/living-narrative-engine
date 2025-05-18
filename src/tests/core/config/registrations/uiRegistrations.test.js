// src/tests/core/config/registrations/uiRegistrations.test.js

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
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

// --- Realistic DOM Mocks ---
let mockInputElement;
let mockDocument;
let mockOutputDiv;
let mockTitleElement;
let mockGameContainer;
let mockActionButtonsContainer;
let mockLocationInfoContainer;
let mockInventoryWidget;
let mockPlayerConfirmTurnButton; // Renamed for clarity and actual ID


const setupDomMocks = () => {
    mockDocument = document; // Use jsdom document
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1');
    mockGameContainer = mockDocument.createElement('div');
    mockActionButtonsContainer = mockDocument.createElement('div');
    mockLocationInfoContainer = mockDocument.createElement('div');
    mockInventoryWidget = mockDocument.createElement('div');
    mockPlayerConfirmTurnButton = mockDocument.createElement('button'); // <<<< IS A BUTTON


    mockInputElement.id = 'input-element';
    mockOutputDiv.id = 'output-div'; // As per HTML provided via main.js
    mockTitleElement.id = 'title-element'; // As per HTML
    mockGameContainer.id = 'game-container'; // Matches your HTML structure indirectly
    mockActionButtonsContainer.id = 'action-buttons'; // As per HTML
    mockLocationInfoContainer.id = 'location-info-container'; // As per HTML
    mockInventoryWidget.id = 'inventory-widget'; // As per HTML
    mockPlayerConfirmTurnButton.id = 'player-confirm-turn-button'; // <<<< CORRECT ID from HTML


    mockDocument.body.innerHTML = '';
    mockDocument.body.appendChild(mockGameContainer); // Main container for some elements
    mockGameContainer.appendChild(mockOutputDiv);     // outputDiv inside game-container
    mockDocument.body.appendChild(mockActionButtonsContainer);
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement);
    mockDocument.body.appendChild(mockLocationInfoContainer);
    mockDocument.body.appendChild(mockInventoryWidget);
    mockDocument.body.appendChild(mockPlayerConfirmTurnButton); // <<<< ADDED TO DOM


    jest.spyOn(mockInputElement, 'addEventListener');
    jest.spyOn(mockInputElement, 'focus');
    jest.spyOn(mockDocument, 'querySelector'); // Ensure this is spied on if factories use it on document directly
    jest.spyOn(mockDocument, 'getElementById'); // Spy if factories might use getElementById
    jest.spyOn(mockDocument, 'createElement');
    jest.spyOn(mockDocument.body, 'appendChild');
};


// --- Mock Custom DI Container (Pure JS Version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance; // To hold the container object for self-reference

    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        if (!token) throw new Error('Mock Register Error: Token is required.');
        registrations.set(token, {factoryOrValue: factoryOrValueOrClass, options: options});
        if (options?.lifecycle?.startsWith('singleton') && instances.has(token)) {
            instances.delete(token); // Clear previous instance if re-registering a singleton
        }
    });

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token); // For error messages
        if (instances.has(token)) return instances.get(token);

        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;

            const isClassForSingle = typeof factoryOrValue === 'function'
                && options?.dependencies // Expected for 'single' registrations
                && Array.isArray(options.dependencies)
                && options?.lifecycle === 'singleton';
            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle; // Covers singletonFactory etc.

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
                        depsMap[propName] = containerInstance.resolve(depToken); // Use containerInstance
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
                    instance = factoryOrValue(containerInstance); // Pass containerInstance to factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve - Factory] Error executing factory for token ${tokenString}:`, factoryError);
                    throw factoryError;
                }
            } else { // Direct value (instance registration)
                instance = factoryOrValue;
            }

            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory') && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        // Fallbacks for essential mocks if not explicitly registered by `registerUI`
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        if (token === tokens.EventBus) return mockEventBus; // Legacy

        // General fallback for element tokens if they are directly resolved (e.g. titleElement from uiArgs)
        // This part may need adjustment based on how specific elements are made available.
        // The test setup below explicitly registers elements from uiArgs.
        // However, if a factory tries to resolve an element by a token that *isn't* from uiArgs,
        // this could be a fallback. For now, specific element tokens from uiArgs are registered directly.

        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    // Assign to containerInstance for self-reference in resolveSpy
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
            // Note: playerConfirmTurnButton is not part of uiArgs; ActionButtonsRenderer factory will query for it
        };

        // Pre-register core dependencies that registerUI itself might resolve
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'}); // For legacy InputHandler if needed

        // Clear spies after pre-registration for accurate call counts in tests
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
        mockContainer.resolve(tokens.IDocumentContext); // Trigger factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        mockContainer.resolve(tokens.DomElementFactory); // Trigger factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
    });

    it('should register UiMessageRenderer using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.UiMessageRenderer);
        expect(instance).toBeInstanceOf(UiMessageRenderer);
        // Check if its dependencies were resolved (example)
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
        registerUI(mockContainer, mockUiArgs);
        const docContextInstance = new DocumentContext(mockDocument);
        const querySpy = jest.spyOn(docContextInstance, 'query').mockReturnValue(mockLocationInfoContainer);

        // Override resolve specifically for this factory's execution path
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            // ... other dependencies for LocationRenderer
            return originalResolve(token); // Fallback for others
        });

        const instance = mockContainer.resolve(tokens.LocationRenderer); // Trigger factory
        expect(instance).toBeInstanceOf(LocationRenderer);
        expect(querySpy).toHaveBeenCalledWith('#location-info-container');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('LocationRenderer'));
        mockContainer.resolve = originalResolve; // Restore
    });

    it('should register InventoryPanel via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs);
        const docContextInstance = new DocumentContext(mockDocument);
        const querySpy = jest.spyOn(docContextInstance, 'query').mockReturnValue(mockInventoryWidget);
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            // ... other dependencies for InventoryPanel
            return originalResolve(token);
        });

        const instance = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance).toBeInstanceOf(InventoryPanel);
        expect(querySpy).toHaveBeenCalledWith('#inventory-widget');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('InventoryPanel'));
        mockContainer.resolve = originalResolve; // Restore
    });

    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs); // This calls the registration

        // Setup mocks for when the factory is executed during resolve
        const docContextInstance = new DocumentContext(mockDocument);
        const domFactoryInstance = new DomElementFactory(docContextInstance);

        // Spy on docContextInstance.query
        const querySpy = jest.spyOn(docContextInstance, 'query');
        querySpy.mockImplementation(selector => {
            if (selector === '#action-buttons') return mockActionButtonsContainer;
            if (selector === '#player-confirm-turn-button') return mockPlayerConfirmTurnButton; // <<<< RETURN THE MOCK BUTTON
            return null;
        });

        // Mock container's resolve to provide dependencies for ActionButtonsRenderer factory
        // Ensure this mockImplementation is active when token.ActionButtonsRenderer is resolved.
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return domFactoryInstance;
            if (token === tokens.ActionButtonsRenderer) { // Handle self-resolution if factory calls resolve on its own token
                const factoryFn = mockContainer._registrations.get(tokens.ActionButtonsRenderer).factoryOrValue;
                return factoryFn(mockContainer); // Execute the actual factory
            }
            return originalResolve(token); // Fallback for others
        });

        // Now, resolve ActionButtonsRenderer to trigger its factory
        const instance1 = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance1).toBeDefined();
        expect(instance1).toBeInstanceOf(ActionButtonsRenderer);

        expect(querySpy).toHaveBeenCalledWith('#action-buttons');
        expect(querySpy).toHaveBeenCalledWith('#player-confirm-turn-button'); // <<<< VERIFY QUERY

        // The warning should not happen because mockPlayerConfirmTurnButton is provided
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("[ActionButtonsRenderer] 'sendButtonElement' (Confirm Action button) was not provided")
        );
        // Also ensure no other ActionButtonsRenderer warnings from the factory if container was missing
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#action-buttons' element for ActionButtonsRenderer"));


        mockContainer.resolve = originalResolve; // Restore original resolve
    });

    it('should register DomUiFacade under its own token using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        // To properly test resolution of DomUiFacade and its deps, we might need more intricate resolve mocking
        // For now, just check registration. Resolution is complex due to many dependencies.
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
        // const instance1 = mockContainer.resolve(tokens.DomUiFacade); // This would be a deeper test
        // expect(instance1).toBeInstanceOf(DomUiFacade);
    });

    it('should register IInputHandler via singletonFactory with IValidatedEventDispatcher', () => {
        registerUI(mockContainer, mockUiArgs);
        // Temporarily override resolve for this specific test path for InputHandler
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn(token => {
            if (token === tokens.inputElement) return mockInputElement;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.IInputHandler) { // For resolving itself during factory call
                const factoryFn = mockContainer._registrations.get(tokens.IInputHandler).factoryOrValue;
                return factoryFn(mockContainer);
            }
            return originalResolve(token); // Fallback for other unmocked tokens if necessary
        });

        const instance1 = mockContainer.resolve(tokens.IInputHandler);
        expect(instance1).toBeInstanceOf(InputHandler);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        mockContainer.resolve = originalResolve; // Restore
    });

    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
    });
});