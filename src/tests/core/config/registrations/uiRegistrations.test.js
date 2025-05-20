// src/tests/core/config/registrations/uiRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../../core/interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerUI} from '../../../../core/config/registrations/uiRegistrations.js';

// --- Dependencies & Concrete Classes ---
import {tokens} from '../../../../core/config/tokens.js';
import InputHandler from '../../../../core/inputHandler.js';
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
    PerceptionLogRenderer
} from '../../../../domUI/index.js';


// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {subscribe: jest.fn(), dispatch: jest.fn()};
const mockValidatedEventDispatcher = {dispatchValidated: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn()};

const mockEntityManagerService = {
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()), // <<< MODIFIED: Added mock for getEntitiesInLocation
};
const mockDataRegistryService = {
    getEntityDefinition: jest.fn(),
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
    mockPerceptionLogList = mockDocument.createElement('ul');


    mockInputElement.id = 'input-element';
    mockOutputDiv.id = 'output-div';
    mockTitleElement.id = 'title-element';
    mockGameContainer.id = 'game-container';
    mockActionButtonsContainer.id = 'action-buttons';
    mockLocationInfoContainer.id = 'location-info-container';
    mockInventoryWidget.id = 'inventory-widget';
    mockPlayerConfirmTurnButton.id = 'player-confirm-turn-button';
    mockPerceptionLogList.id = 'perception-log-list';


    mockDocument.body.innerHTML = '';
    mockDocument.body.appendChild(mockGameContainer);
    mockGameContainer.appendChild(mockOutputDiv);
    mockDocument.body.appendChild(mockActionButtonsContainer);
    mockDocument.body.appendChild(mockTitleElement);
    mockDocument.body.appendChild(mockInputElement);
    mockDocument.body.appendChild(mockLocationInfoContainer);
    mockDocument.body.appendChild(mockInventoryWidget);
    mockDocument.body.appendChild(mockPlayerConfirmTurnButton);
    mockDocument.body.appendChild(mockPerceptionLogList);


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
                        console.error(`[Mock Resolve - isClassForSingle] Failed to resolve dependency '${String(depToken)}' (as '${propName}') for '${ClassConstructor.name}'`);
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
        if (token === tokens.IEntityManager) return mockEntityManagerService;


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
        const iDocContextReg = mockContainer._registrations.get(tokens.IDocumentContext);
        expect(iDocContextReg).toBeDefined();
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
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomElementFactory);
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
        const domFactoryInstance = new DomElementFactory(docContextInstance);
        const querySpy = jest.spyOn(docContextInstance, 'query').mockReturnValue(mockLocationInfoContainer);

        const originalResolve = mockContainer.resolve;
        const resolveTracker = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return domFactoryInstance;
            if (token === tokens.IEntityManager) return mockEntityManagerService; // This will now provide the mock with getEntitiesInLocation
            if (token === tokens.IDataRegistry) return mockDataRegistryService;
            if (token === tokens.LocationRenderer) {
                const registration = mockContainer._registrations.get(tokens.LocationRenderer);
                return registration.factoryOrValue(mockContainer);
            }
            return originalResolve(token);
        });
        mockContainer.resolve = resolveTracker;

        // Clear mock call counts for entityManagerService before resolving LocationRenderer
        mockEntityManagerService.getEntityInstance.mockClear();
        mockEntityManagerService.getEntitiesInLocation.mockClear();


        const instance = mockContainer.resolve(tokens.LocationRenderer);

        expect(instance).toBeInstanceOf(LocationRenderer);
        expect(querySpy).toHaveBeenCalledWith('#location-info-container');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Could not find '#location-info-container' element for LocationRenderer")
        );
        expect(resolveTracker).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.DomElementFactory);
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
                return registration.factoryOrValue(mockContainer);
            }
            return originalResolve(token);
        });

        const instance = mockContainer.resolve(tokens.InventoryPanel);
        expect(instance).toBeInstanceOf(InventoryPanel);
        expect(querySpy).toHaveBeenCalledWith('#inventory-widget');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#inventory-widget' element for InventoryPanel"));
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
                return registration.factoryOrValue(mockContainer);
            }
            return originalResolve(token);
        });

        const instance = mockContainer.resolve(tokens.ActionButtonsRenderer);
        expect(instance).toBeInstanceOf(ActionButtonsRenderer);
        expect(querySpy).toHaveBeenCalledWith('#action-buttons');
        expect(querySpy).toHaveBeenCalledWith('#player-confirm-turn-button');
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Could not find '#action-buttons' element for ActionButtonsRenderer"));
        mockContainer.resolve = originalResolve;
    });

    it('should register PerceptionLogRenderer via singletonFactory', () => {
        registerUI(mockContainer, mockUiArgs);

        const docContextInstance = new DocumentContext(mockDocument);
        const domFactoryInstance = new DomElementFactory(docContextInstance);
        const querySpy = jest.spyOn(docContextInstance, 'query').mockImplementation(selector => {
            if (selector === `#${'perception-log-list'}`) return mockPerceptionLogList;
            return null;
        });


        const originalResolve = mockContainer.resolve;
        const resolveTracker = jest.fn(token => {
            if (token === tokens.IDocumentContext) return docContextInstance;
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.DomElementFactory) return domFactoryInstance;
            if (token === tokens.IEntityManager) return mockEntityManagerService;
            if (token === tokens.PerceptionLogRenderer) {
                const registration = mockContainer._registrations.get(tokens.PerceptionLogRenderer);
                return registration.factoryOrValue(mockContainer);
            }
            return originalResolve(token);
        });
        mockContainer.resolve = resolveTracker;

        const instance = mockContainer.resolve(tokens.PerceptionLogRenderer);
        expect(instance).toBeInstanceOf(PerceptionLogRenderer);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.ILogger);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.IDocumentContext);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.DomElementFactory);
        expect(resolveTracker).toHaveBeenCalledWith(tokens.IEntityManager);
        expect(querySpy).toHaveBeenCalledWith('#perception-log-list');

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
                tokens.ActionButtonsRenderer,
                tokens.InventoryPanel,
                tokens.LocationRenderer,
                tokens.TitleRenderer,
                tokens.InputStateController,
                tokens.UiMessageRenderer,
                tokens.PerceptionLogRenderer
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
                return registration.factoryOrValue(mockContainer);
            }
            return originalResolve(token);
        });

        const instance = mockContainer.resolve(tokens.IInputHandler);
        expect(instance).toBeInstanceOf(InputHandler);
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