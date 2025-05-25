// tests/config/registrations/uiRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../src/interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../../core/interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */ // Added
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */ // <<< ADDED for LlmSelectionModal test
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerUI} from '../../../src/config/registrations/uiRegistrations.js';

// --- Dependencies & Concrete Classes ---
import {tokens} from '../../../src/config/tokens.js';
import InputHandler from '../../../src/input/inputHandler.js';
import {
    UiMessageRenderer,
    DomElementFactory,
    DocumentContext,
    DomUiFacade,
    TitleRenderer,
    InputStateController,
    LocationRenderer,
    InventoryPanel,
    ActionButtonsRenderer,
    PerceptionLogRenderer,
    LlmSelectionModal // <<< ADDED
} from '../../../src/domUI/index.js';
import SaveGameUI from '../../../src/domUI/saveGameUI.js'; // Added
import LoadGameUI from '../../../src/domUI/loadGameUI.js'; // Added


// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

const mockEntityManagerService = {
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
};
const mockDataRegistryService = {
    getEntityDefinition: jest.fn(),
};
const mockSaveLoadService = { // Added
    listManualSaveSlots: jest.fn(),
    loadGameData: jest.fn(),
    saveManualGame: jest.fn(),
    deleteManualSave: jest.fn(),
};
const mockLlmAdapter = { // <<< ADDED
    getAvailableLlmOptions: jest.fn(),
    getCurrentActiveLlmId: jest.fn(),
    setActiveLlm: jest.fn(),
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
let mockPerceptionLogList;
let mockOpenSaveGameButton;
let mockOpenLoadGameButton;
let mockChangeLlmButton; // <<< ADDED
let mockLlmSelectionModalElement; // <<< ADDED
let mockLlmSelectionListElement; // <<< ADDED
let mockLlmSelectionModalCloseButton; // <<< ADDED
let mockLlmSelectionStatusMessageElement; // <<< ADDED


const setupDomMocks = () => {
    /* -------------------------------------------------
     * 1. build the DOM structure the tests rely on
     * ------------------------------------------------- */
    mockDocument = document;            // jsdom's global document
    mockDocument.body.innerHTML = '';   // clean slate

    // core elements
    mockInputElement = mockDocument.createElement('input');
    mockOutputDiv = mockDocument.createElement('div');
    mockTitleElement = mockDocument.createElement('h1');

    // containers & widgets
    mockGameContainer = mockDocument.createElement('div');
    mockActionButtonsContainer = mockDocument.createElement('div');
    mockLocationInfoContainer = mockDocument.createElement('div');
    mockInventoryWidget = mockDocument.createElement('div');
    mockPlayerConfirmTurnButton = mockDocument.createElement('button');
    mockPerceptionLogList = mockDocument.createElement('ul');
    mockOpenSaveGameButton = mockDocument.createElement('button');
    mockOpenLoadGameButton = mockDocument.createElement('button');

    // LLM-selection bits
    mockChangeLlmButton = mockDocument.createElement('button');
    mockLlmSelectionModalElement = mockDocument.createElement('div');
    mockLlmSelectionListElement = mockDocument.createElement('ul');
    mockLlmSelectionModalCloseButton = mockDocument.createElement('button');
    mockLlmSelectionStatusMessageElement = mockDocument.createElement('div');

    // give them the IDs the production code looks for
    mockInputElement.id = 'input-element';
    mockOutputDiv.id = 'output-div';
    mockTitleElement.id = 'title-element';
    mockGameContainer.id = 'game-container';
    mockActionButtonsContainer.id = 'action-buttons';
    mockLocationInfoContainer.id = 'location-info-container';
    mockInventoryWidget.id = 'inventory-widget';
    mockPlayerConfirmTurnButton.id = 'player-confirm-turn-button';
    mockPerceptionLogList.id = 'perception-log-list';
    mockOpenSaveGameButton.id = 'open-save-game-button';
    mockOpenLoadGameButton.id = 'open-load-game-button';
    mockChangeLlmButton.id = 'change-llm-button';
    mockLlmSelectionModalElement.id = 'llm-selection-modal';
    mockLlmSelectionListElement.id = 'llm-selection-list';
    mockLlmSelectionModalCloseButton.id = 'llm-selection-modal-close-button';
    mockLlmSelectionStatusMessageElement.id = 'llm-selection-status-message';

    // stitch them into the DOM
    mockDocument.body.appendChild(mockGameContainer);
    mockGameContainer.appendChild(mockOutputDiv);

    mockDocument.body.append(
        mockActionButtonsContainer,
        mockTitleElement,
        mockInputElement,
        mockLocationInfoContainer,
        mockInventoryWidget,
        mockPlayerConfirmTurnButton,
        mockPerceptionLogList,
        mockOpenSaveGameButton,
        mockOpenLoadGameButton,
        mockChangeLlmButton,
        mockLlmSelectionModalElement
    );

    mockLlmSelectionModalElement.append(
        mockLlmSelectionListElement,
        mockLlmSelectionModalCloseButton,
        mockLlmSelectionStatusMessageElement
    );

    /* -------------------------------------------------
     * 2. harmless spies (leave createElement/appendChild, etc.)
     * ------------------------------------------------- */
    jest.spyOn(mockDocument, 'getElementById');
    jest.spyOn(mockDocument, 'createElement');
    jest.spyOn(mockDocument.body, 'appendChild');

    /* -------------------------------------------------
     * 3. single, safe querySelector spy
     * ------------------------------------------------- */
    const nativeQuerySelector = Document.prototype.querySelector;
    jest
        .spyOn(mockDocument, 'querySelector')
        .mockImplementation(function (selector) {
            switch (selector) {
                case '#change-llm-button':
                    return mockChangeLlmButton;
                case '#llm-selection-modal':
                    return mockLlmSelectionModalElement;
                case '#llm-selection-list':
                    return mockLlmSelectionListElement;
                case '#llm-selection-modal-close-button':
                    return mockLlmSelectionModalCloseButton;
                case '#llm-selection-status-message':
                    return mockLlmSelectionStatusMessageElement;
                case '#location-info-container':
                    return mockLocationInfoContainer;
                case '#inventory-widget':
                    return mockInventoryWidget;
                case '#action-buttons':
                    return mockActionButtonsContainer;
                case '#player-confirm-turn-button':
                    return mockPlayerConfirmTurnButton;
                case '#perception-log-list':
                    return mockPerceptionLogList;
                default:
                    return nativeQuerySelector.call(this, selector);
            }
        });
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
        const tokenString = String(token); // Use String() for Symbols
        if (instances.has(token)) return instances.get(token);

        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient';
            let instance;

            const isClassForSingle = typeof factoryOrValue === 'function'
                && options?.dependencies
                && Array.isArray(options.dependencies)
                // && options?.lifecycle === 'singleton'; // Modified to allow 'single' as well
                && (options?.lifecycle === 'singleton' || options?.lifecycle === 'single');


            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle;


            if (isClassForSingle) {
                const ClassConstructor = factoryOrValue;
                const resolvedDeps = options.dependencies.map(depToken => {
                    try {
                        return containerInstance.resolve(depToken);
                    } catch (resolveError) {
                        console.error(`[Mock Resolve - isClassForSingle] Failed to resolve dependency '${String(depToken)}' for '${ClassConstructor.name}'`);
                        throw resolveError;
                    }
                });
                try {
                    // The 'single' registration in Registrar.js passes an array of resolved dependencies.
                    // The mock container should mimic this for classes registered with 'single'.
                    // For 'singletonFactory' which passes the container itself, that's handled by `isFactoryFunction`.
                    // The DomUiFacade is registered with `registrar.single(Token, Class, [depTokens])`
                    // which should result in ClassConstructor(...resolvedDepsArray)
                    // However, our current DomUiFacade constructor expects a single object with named properties.
                    // The `Registrar.js` handles this by creating an object from the resolved deps.
                    // This mock needs to simulate that specific behavior if the test is for `registrar.single`.

                    // If the ClassConstructor expects an object of dependencies:
                    const depsObject = {};
                    options.dependencies.forEach((depToken, index) => {
                        // Simplistic conversion of token name to property name.
                        // This needs to be robust or match how the actual Registrar creates the dep object.
                        // For example, tokens.ActionButtonsRenderer becomes actionButtonsRenderer.
                        let propName = String(depToken).replace('Symbol(', '').replace(')', ''); // Basic symbol cleanup
                        if (propName.startsWith('I') && propName.length > 1 && propName[1] === propName[1].toUpperCase()) {
                            propName = propName.substring(1); // Remove 'I' if it's like ILogger -> Logger
                        }
                        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                        depsObject[propName] = resolvedDeps[index];
                    });
                    instance = new ClassConstructor(depsObject);

                } catch (constructorError) {
                    console.error(`[Mock Resolve - isClassForSingle] Error constructing '${ClassConstructor.name}' with deps:`, resolvedDeps, constructorError);
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

            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory' || lifecycle === 'single' || (options.isInstance && lifecycle === 'singleton')) && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.IEntityManager) return mockEntityManagerService;
        if (token === tokens.IDataRegistry) return mockDataRegistryService;
        if (token === tokens.ISaveLoadService) return mockSaveLoadService;
        if (token === tokens.ILLMAdapter) return mockLlmAdapter; // <<< ADDED

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
        mockContainer.register(tokens.IEntityManager, mockEntityManagerService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistryService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISaveLoadService, mockSaveLoadService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ILLMAdapter, mockLlmAdapter, {lifecycle: 'singleton'}); // <<< ADDED


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
        // registrar.instance(token, value) calls container.register(token, value, { lifecycle: 'singleton' })
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.WindowDocument, mockDocument, {
            isInstance: true,
            lifecycle: 'singleton'
        });
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, {
            isInstance: true,
            lifecycle: 'singleton'
        });
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, {
            isInstance: true,
            lifecycle: 'singleton'
        });
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, {
            isInstance: true,
            lifecycle: 'singleton'
        });
    });

    it('should register IDocumentContext via singletonFactory resolving to DocumentContext', () => {
        registerUI(mockContainer, mockUiArgs);
        const iDocContextReg = mockContainer._registrations.get(tokens.IDocumentContext);
        expect(iDocContextReg).toBeDefined();
        expect(iDocContextReg.options.lifecycle).toBe('singletonFactory');
        const instance = mockContainer.resolve(tokens.IDocumentContext);
        expect(instance).toBeInstanceOf(DocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
    });

    it('should register DomElementFactory via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.DomElementFactory);
        expect(instance).toBeInstanceOf(DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
    });

    it('should register UiMessageRenderer using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.UiMessageRenderer);
        expect(instance).toBeInstanceOf(UiMessageRenderer);
        // Check constructor arguments by spying on the class constructor or checking properties
        // For `single`, the container resolves deps and passes them as an object.
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.UiMessageRenderer);
        expect(regCall[2].dependencies).toEqual([
            tokens.ILogger,
            tokens.IDocumentContext,
            tokens.IValidatedEventDispatcher,
            tokens.DomElementFactory
        ]);
    });

    it('should register TitleRenderer via singletonFactory injecting titleElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.TitleRenderer);
        expect(instance).toBeInstanceOf(TitleRenderer);
        // Factory function is called with the container. Ensure titleElement is resolved within it.
        // The mock resolve will be called for tokens.titleElement.
        // We can check if the factory, when called, resolves the correct token.
        const factoryFn = mockContainer._registrations.get(tokens.TitleRenderer).factoryOrValue;
        factoryFn(mockContainer); // Execute factory to trigger internal resolves
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement);
    });

    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.InputStateController);
        expect(instance).toBeInstanceOf(InputStateController);
        const factoryFn = mockContainer._registrations.get(tokens.InputStateController).factoryOrValue;
        factoryFn(mockContainer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
    });

    it('should register LocationRenderer via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs);

        // The original mockDocument.querySelector is already spied on in setupDomMocks
        // and set to return specific elements or call the original.
        // We just need to ensure it's called with the right selector.

        const instance = mockContainer.resolve(tokens.LocationRenderer);

        expect(instance).toBeInstanceOf(LocationRenderer);
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#location-info-container');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Could not find '#location-info-container' element for LocationRenderer")
        );
        // Check other resolved dependencies within the factory
        const factoryFn = mockContainer._registrations.get(tokens.LocationRenderer).factoryOrValue;
        factoryFn(mockContainer); // to trigger resolves inside factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
    });

    it('should register InventoryPanel via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance).toBeInstanceOf(InventoryPanel);
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#inventory-widget');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#inventory-widget' element for InventoryPanel"));
    });

    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance).toBeInstanceOf(ActionButtonsRenderer);
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#action-buttons');
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#player-confirm-turn-button');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#action-buttons' element for ActionButtonsRenderer"));
    });

    it('should register PerceptionLogRenderer via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.PerceptionLogRenderer);
        expect(instance).toBeInstanceOf(PerceptionLogRenderer);
        // Check factory dependencies
        const factoryFn = mockContainer._registrations.get(tokens.PerceptionLogRenderer).factoryOrValue;
        factoryFn(mockContainer); // to trigger resolves
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        // PerceptionLogRenderer's constructor now queries for '#perception-log-list' itself
        // So the test for querySpy is better placed in its own unit test.
        // Here we just ensure the factory resolves what it needs.
    });

    // <<< ADDED TEST FOR LlmSelectionModal
    it('should register LlmSelectionModal via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.LlmSelectionModal);
        expect(instance).toBeInstanceOf(LlmSelectionModal);
        const factoryFn = mockContainer._registrations.get(tokens.LlmSelectionModal).factoryOrValue;
        factoryFn(mockContainer); // to trigger resolves
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILLMAdapter);

        // Check that DOM elements are queried for LlmSelectionModal
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#change-llm-button');
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#llm-selection-modal');
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#llm-selection-list');
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#llm-selection-modal-close-button');
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#llm-selection-status-message');
    });


    it('should register DomUiFacade under its own token using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomUiFacade);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toBe(DomUiFacade);

        const expectedDeps = [
            tokens.ActionButtonsRenderer,
            tokens.InventoryPanel,
            tokens.LocationRenderer,
            tokens.TitleRenderer,
            tokens.InputStateController,
            tokens.UiMessageRenderer,
            tokens.SpeechBubbleRenderer,
            tokens.PerceptionLogRenderer,
            tokens.SaveGameUI,
            tokens.LoadGameUI,
            tokens.LlmSelectionModal
        ];
        // regCall[2] is the options object: { lifecycle: 'single', dependencies: [...] }
        // The actual registrar maps `single` to `lifecycle: 'singleton'` and passes dependencies.
        // For a direct `container.register` call for `single`, the options might differ.
        // The `Registrar` helper class standardizes this.
        // The mock container's `registerSpy` gets `options`.
        // The `Registrar.single` translates to:
        // `this.container.register(token, ConcreteClass, { lifecycle: 'singleton', dependencies: depTokens });`
        expect(regCall[2]).toEqual({
            lifecycle: 'singleton', // registrar.single uses 'singleton' as lifecycle for the container
            dependencies: expectedDeps
        });
    });

    it('should register IInputHandler via singletonFactory with IValidatedEventDispatcher', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.IInputHandler);
        expect(instance).toBeInstanceOf(InputHandler);
        // Check factory resolves
        const factoryFn = mockContainer._registrations.get(tokens.IInputHandler).factoryOrValue;
        factoryFn(mockContainer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
    });

    it('should log completion messages', () => {
        registerUI(mockContainer, mockUiArgs);
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Starting (Refactored DOM UI)...');
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Complete.');
    });
});