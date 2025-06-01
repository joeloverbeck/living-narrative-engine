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
    // InventoryPanel, // Removed InventoryPanel import
    ActionButtonsRenderer,
    PerceptionLogRenderer,
    LlmSelectionModal
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
let mockChangeLlmButton;
let mockLlmSelectionModalElement;
let mockLlmSelectionListElement;
let mockLlmSelectionModalCloseButton;
let mockLlmSelectionStatusMessageElement;


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
    mockInputElement.id = 'input-element'; // Corresponds to tokens.inputElement in registrations
    mockOutputDiv.id = 'output-div'; // Corresponds to tokens.outputDiv
    mockTitleElement.id = 'title-element'; // Corresponds to tokens.titleElement
    mockGameContainer.id = 'game-container';
    mockActionButtonsContainer.id = 'action-buttons'; // Used by ActionButtonsRenderer
    mockLocationInfoContainer.id = 'location-info-container'; // Used by LocationRenderer
    mockInventoryWidget.id = 'inventory-widget'; // No longer directly used by a registered component in these tests
    mockPlayerConfirmTurnButton.id = 'player-confirm-turn-button'; // Used by ActionButtonsRenderer
    mockPerceptionLogList.id = 'perception-log-list'; // Used by PerceptionLogRenderer's constructor
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
        mockInventoryWidget, // Still in DOM for completeness, though its JS class is removed from DI
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
                case '#inventory-widget': // This will still be called if code tries to find it
                    return mockInventoryWidget;
                case '#action-buttons':
                    return mockActionButtonsContainer;
                case '#player-confirm-turn-button':
                    return mockPlayerConfirmTurnButton;
                case '#perception-log-list':
                    return mockPerceptionLogList;
                default:
                    // Fallback to the original querySelector for other selectors
                    // This is important for other DOM interactions that might occur.
                    return nativeQuerySelector.call(this, selector);
            }
        });
};


// --- Mock Custom DI Container (Pure JS Version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map();
    let containerInstance; // To be assigned the object itself for internal .resolve calls

    // Spy on the register method
    const registerSpy = jest.fn((token, factoryOrValueOrClass, options = {}) => {
        if (!token) throw new Error('Mock Register Error: Token is required.');
        registrations.set(token, {factoryOrValue: factoryOrValueOrClass, options: options});
        // If it's a singleton and already instantiated, clear the old instance
        if (options?.lifecycle?.startsWith('singleton') && instances.has(token)) {
            instances.delete(token);
        }
    });

    const resolveSpy = jest.fn((token) => {
        const tokenString = String(token); // For debugging, convert Symbol to string

        if (instances.has(token)) return instances.get(token);

        const registration = registrations.get(token);
        if (registration) {
            const {factoryOrValue, options} = registration;
            const lifecycle = options?.lifecycle || 'transient'; // Default to transient
            let instance;

            // Determine if it's a class constructor for 'single' or a factory function
            const isClassForSingle = typeof factoryOrValue === 'function'
                && options?.dependencies // 'single' expects dependencies array
                && Array.isArray(options.dependencies)
                && (options?.lifecycle === 'singleton' || options?.lifecycle === 'single'); // Registrar.single uses 'singleton'

            const isFactoryFunction = typeof factoryOrValue === 'function' && !isClassForSingle;


            if (isClassForSingle) {
                const ClassConstructor = factoryOrValue;
                // Resolve dependencies first
                const resolvedDeps = options.dependencies.map(depToken => {
                    try {
                        return containerInstance.resolve(depToken); // Use the containerInstance for resolution
                    } catch (resolveError) {
                        console.error(`[Mock Resolve - isClassForSingle] Failed to resolve dependency '${String(depToken)}' for '${ClassConstructor.name}'`);
                        throw resolveError; // Re-throw to fail test if a dep is missing
                    }
                });
                try {
                    // The actual Registrar.js for 'single' prepares a dependency object
                    // where keys are derived from token names. This mock needs to simulate that.
                    const depsObject = {};
                    options.dependencies.forEach((depToken, index) => {
                        let propName = String(depToken).replace(/^Symbol\((.+)\)$/, '$1'); // Extract name from Symbol
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
                // This is for singletonFactory or transient factories
                try {
                    instance = factoryOrValue(containerInstance); // Pass the container to the factory
                } catch (factoryError) {
                    console.error(`[Mock Resolve - Factory] Error executing factory for token ${tokenString}:`, factoryError);
                    throw factoryError; // Re-throw
                }
            } else {
                // This is for direct instance registration (value)
                instance = factoryOrValue;
            }

            // Cache instance if it's a singleton type
            if ((lifecycle === 'singleton' || lifecycle === 'singletonFactory' || lifecycle === 'single' || (options.isInstance && lifecycle === 'singleton')) && instance !== undefined) {
                instances.set(token, instance);
            }
            return instance;
        }

        // Fallback for tokens not in registrations map but might be directly mocked
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
        if (token === tokens.EventBus) return mockEventBus; // Though likely registered above
        if (token === tokens.IEntityManager) return mockEntityManagerService;
        if (token === tokens.IDataRegistry) return mockDataRegistryService;
        if (token === tokens.ISaveLoadService) return mockSaveLoadService;
        if (token === tokens.ILLMAdapter) return mockLlmAdapter;


        throw new Error(`Mock Resolve Error: Token not registered or explicitly mocked: ${tokenString}`);
    });

    // Assign the container methods to the containerInstance so factories can use c.resolve()
    containerInstance = {
        _registrations: registrations, // For inspection in tests
        _instances: instances,       // For inspection in tests
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
        setupDomMocks(); // Sets up mockDocument, mockInputElement, etc.
        mockContainer = createMockContainer();

        // Prepare the uiElements object passed to registerUI
        mockUiArgs = {
            inputElement: mockInputElement,
            document: mockDocument,
            outputDiv: mockOutputDiv,
            titleElement: mockTitleElement,
            // other elements if needed by bootstrap logic not covered here
        };

        // Pre-register common services that registerUI itself doesn't register
        // but factories within it might try to resolve.
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IEntityManager, mockEntityManagerService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IDataRegistry, mockDataRegistryService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISaveLoadService, mockSaveLoadService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ILLMAdapter, mockLlmAdapter, {lifecycle: 'singleton'});


        // Clear mocks on the container itself from pre-registration
        mockContainer.register.mockClear();
        mockContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores original implementations if any were spied on globally
        if (document && document.body) document.body.innerHTML = ''; // Clean JSDOM
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

        // Resolve it to ensure the factory works as expected
        const instance = mockContainer.resolve(tokens.IDocumentContext);
        expect(instance).toBeInstanceOf(DocumentContext);
        // Check that the factory, when called, resolves its dependency (WindowDocument)
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
        factoryFn(mockContainer);
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
        const instance = mockContainer.resolve(tokens.LocationRenderer);
        expect(instance).toBeInstanceOf(LocationRenderer);
        expect(mockDocument.querySelector).toHaveBeenCalledWith('#location-info-container');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Could not find '#location-info-container' element for LocationRenderer")
        );
        const factoryFn = mockContainer._registrations.get(tokens.LocationRenderer).factoryOrValue;
        factoryFn(mockContainer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
    });

    // Removed test for InventoryPanel registration

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
        factoryFn(mockContainer);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILLMAdapter);
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
            // tokens.InventoryPanel, // Removed
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