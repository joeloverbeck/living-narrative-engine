// tests/config/registrations/uiRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../src/interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../src/core/interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */ // Corrected path assuming core/interfaces
/** @typedef {import('../../../src/interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/services/EntityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider */ // Added for mocking
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
    ActionButtonsRenderer,
    PerceptionLogRenderer,
    LlmSelectionModal,
    SpeechBubbleRenderer, // Ensured import for facade test
    CurrentTurnActorRenderer // Ensured import
} from '../../../src/domUI/index.js';
import SaveGameUI from '../../../src/domUI/saveGameUI.js';
import LoadGameUI from '../../../src/domUI/loadGameUI.js';


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
const mockSaveLoadService = {
    listManualSaveSlots: jest.fn(),
    loadGameData: jest.fn(),
    saveManualGame: jest.fn(),
    deleteManualSave: jest.fn(),
};
const mockLlmAdapter = {
    getAvailableLlmOptions: jest.fn(),
    getCurrentActiveLlmId: jest.fn(),
    setActiveLlm: jest.fn(),
};

// +++ ADDED MOCK FOR EntityDisplayDataProvider +++
const mockEntityDisplayDataProviderService = {
    getEntityLocationId: jest.fn(),
    getLocationDetails: jest.fn(),
    getCharacterDisplayInfo: jest.fn(),
    getEntityName: jest.fn(),
    getEntityPortraitPath: jest.fn(),
    getLocationPortraitData: jest.fn(),
    // Add other methods if any constructors being tested call them directly
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
let mockChangeLlmButton;
let mockLlmSelectionModalElement;
let mockLlmSelectionListElement;
let mockLlmSelectionModalCloseButton;
let mockLlmSelectionStatusMessageElement;
// +++ ADDED MOCK DOM ELEMENTS for CurrentTurnActorRenderer +++
let mockActorVisualsElement;
let mockActorImageElement;
let mockActorNameElement;


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

    // +++ CurrentTurnActorRenderer DOM elements +++
    const currentTurnActorPanel = mockDocument.createElement('div'); // Parent for selector
    currentTurnActorPanel.id = 'current-turn-actor-panel';
    mockActorVisualsElement = mockDocument.createElement('div');
    mockActorVisualsElement.className = 'actor-visuals'; // Match selector
    mockActorImageElement = mockDocument.createElement('img');
    mockActorImageElement.id = 'current-actor-image';     // Match selector
    mockActorNameElement = mockDocument.createElement('div');
    mockActorNameElement.className = 'actor-name-display'; // Match selector

    currentTurnActorPanel.appendChild(mockActorVisualsElement);
    mockActorVisualsElement.appendChild(mockActorImageElement); // Image is often inside visuals
    currentTurnActorPanel.appendChild(mockActorNameElement);


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
    mockDocument.body.appendChild(currentTurnActorPanel); // Add current turn actor panel

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

    // +++ LocationRenderer sub-elements (ensure they are within mockLocationInfoContainer for scoping if needed) +++
    const mockNameDisplay = document.createElement('div');
    mockNameDisplay.id = 'location-name-display';
    const mockDescriptionDisplay = document.createElement('div');
    mockDescriptionDisplay.id = 'location-description-display';
    const mockExitsDisplay = document.createElement('div');
    mockExitsDisplay.id = 'location-exits-display';
    const mockCharactersDisplay = document.createElement('div');
    mockCharactersDisplay.id = 'location-characters-display';
    mockLocationInfoContainer.append(mockNameDisplay, mockDescriptionDisplay, mockExitsDisplay, mockCharactersDisplay);


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
            // console.log('querySelector called with:', selector); // Debugging line
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
                case '#location-name-display':
                    return mockLocationInfoContainer.querySelector('#location-name-display');
                case '#location-description-display':
                    return mockLocationInfoContainer.querySelector('#location-description-display');
                case '#location-exits-display':
                    return mockLocationInfoContainer.querySelector('#location-exits-display');
                case '#location-characters-display':
                    return mockLocationInfoContainer.querySelector('#location-characters-display');
                case '#inventory-widget':
                    return mockInventoryWidget;
                case '#action-buttons':
                    return mockActionButtonsContainer;
                case '#player-confirm-turn-button':
                    return mockPlayerConfirmTurnButton;
                case '#perception-log-list':
                    return mockPerceptionLogList;
                // +++ CurrentTurnActorRenderer selectors +++
                case '#current-turn-actor-panel .actor-visuals':
                    return mockActorVisualsElement;
                case '#current-turn-actor-panel #current-actor-image':
                    return mockActorImageElement;
                case '#current-turn-actor-panel .actor-name-display':
                    return mockActorNameElement;
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
                    const depsObject = {};
                    options.dependencies.forEach((depToken, index) => {
                        let propName = String(depToken).replace(/^Symbol\((.+)\)$/, '$1');
                        if (propName.startsWith('I') && propName.length > 1 && propName[1] === propName[1].toUpperCase()) {
                            propName = propName.substring(1);
                        }
                        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                        depsObject[propName] = resolvedDeps[index];
                    });
                    instance = new ClassConstructor(depsObject);
                } catch (constructorError) {
                    console.error(`[Mock Resolve - isClassForSingle] Error constructing '${ClassConstructor.name}' with deps object:`, constructorError);
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
        if (token === tokens.ILLMAdapter) return mockLlmAdapter;
        // +++ ADDED FALLBACK FOR EntityDisplayDataProvider FOR TEST ISOLATION +++
        // This ensures if it's somehow not pre-registered by a test but resolved, it returns a mock
        if (token === tokens.EntityDisplayDataProvider) {
            // console.warn(`[Mock Resolve - Fallback] Returning shared mock for ${String(token)}.`);
            return mockEntityDisplayDataProviderService;
        }


        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

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

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'}); // For ISafeEventDispatcher
        mockContainer.register(tokens.ISafeEventDispatcher, mockEventBus, {lifecycle: 'singleton'}); // Explicitly for EngineUIManager
        mockContainer.register(tokens.IEntityManager, mockEntityManagerService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistryService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISaveLoadService, mockSaveLoadService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ILLMAdapter, mockLlmAdapter, {lifecycle: 'singleton'});
        // +++ PRE-REGISTER EntityDisplayDataProvider +++
        mockContainer.register(tokens.EntityDisplayDataProvider, mockEntityDisplayDataProviderService, {lifecycle: 'singleton'});


        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        // Clear specific mocks for EntityDisplayDataProvider methods if needed before each test
        Object.values(mockEntityDisplayDataProviderService).forEach(mockFn => {
            if (jest.isMockFunction(mockFn)) {
                mockFn.mockClear();
            }
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) document.body.innerHTML = '';
    });

    it('should register essential external dependencies (document, elements) as singleton instances', () => {
        registerUI(mockContainer, mockUiArgs);
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
        const factoryFn = mockContainer._registrations.get(tokens.TitleRenderer).factoryOrValue;
        factoryFn(mockContainer); // Execute factory to check resolved deps
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.titleElement);
    });

    it('should register InputStateController via singletonFactory injecting inputElement', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.InputStateController);
        expect(instance).toBeInstanceOf(InputStateController);
        const factoryFn = mockContainer._registrations.get(tokens.InputStateController).factoryOrValue;
        factoryFn(mockContainer); // Execute factory
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
    });

    it('should register LocationRenderer via singletonFactory querying for its container', () => {
        registerUI(mockContainer, mockUiArgs);
        // We need to ensure EntityDisplayDataProvider is resolved, which is now pre-registered.
        // mockContainer.resolve.mockClear(); // Clear resolve calls from pre-registration

        const instance = mockContainer.resolve(tokens.LocationRenderer);
        expect(instance).toBeInstanceOf(LocationRenderer);

        // Check that the DOM query for the container was made
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#location-info-container');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Could not find '#location-info-container' element for LocationRenderer")
        );

        // To verify internal dependencies of LocationRenderer's factory were resolved:
        const factoryFn = mockContainer._registrations.get(tokens.LocationRenderer).factoryOrValue;

        // Before calling factoryFn, clear resolve mocks if you only want to trace *this* factory's resolves
        // mockContainer.resolve.mockClear();
        factoryFn(mockContainer); // Execute the factory

        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        // Crucially, check that EntityDisplayDataProvider was resolved
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.EntityDisplayDataProvider);
    });


    it('should register ActionButtonsRenderer via singletonFactory querying for container', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance).toBeInstanceOf(ActionButtonsRenderer);
        // ActionButtonsRenderer constructor itself uses these selectors via BoundDomRendererBase
        // The factory in uiRegistrations passes these selectors, so no direct querySelector call from the factory itself.
        // expect(mockDocument.querySelector).toHaveBeenCalledWith('#action-buttons');
        // expect(mockDocument.querySelector).toHaveBeenCalledWith('#player-confirm-turn-button');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#action-buttons' element for ActionButtonsRenderer"));
    });

    it('should register PerceptionLogRenderer via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.PerceptionLogRenderer);
        expect(instance).toBeInstanceOf(PerceptionLogRenderer);
        const factoryFn = mockContainer._registrations.get(tokens.PerceptionLogRenderer).factoryOrValue;
        factoryFn(mockContainer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
    });

    it('should register LlmSelectionModal via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.LlmSelectionModal);
        expect(instance).toBeInstanceOf(LlmSelectionModal);
        const factoryFn = mockContainer._registrations.get(tokens.LlmSelectionModal).factoryOrValue;
        factoryFn(mockContainer); // Execute the factory to check resolutions
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILLMAdapter);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher); // <<< --- ADDED THIS LINE ---
        // LlmSelectionModal constructor calls querySelector internally for '#change-llm-button'
        // This check is more about the factory resolving dependencies, internal queries are tested in LlmSelectionModal's own tests.
        // expect(mockDocument.querySelector).toHaveBeenCalledWith('#change-llm-button');
    });


    it('should register DomUiFacade under its own token using single()', () => {
        registerUI(mockContainer, mockUiArgs);
        const regCall = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomUiFacade);
        expect(regCall).toBeDefined();
        expect(regCall[1]).toBe(DomUiFacade);

        const expectedDeps = [
            tokens.ActionButtonsRenderer,
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
        expect(regCall[2]).toEqual({
            lifecycle: 'singleton',
            dependencies: expectedDeps
        });
    });

    it('should register IInputHandler via singletonFactory with IValidatedEventDispatcher', () => {
        registerUI(mockContainer, mockUiArgs);
        const instance = mockContainer.resolve(tokens.IInputHandler);
        expect(instance).toBeInstanceOf(InputHandler);
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