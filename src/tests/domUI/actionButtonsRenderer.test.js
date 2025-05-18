// src/tests/domUI/actionButtonsRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Using index import
import DocumentContext from '../../domUI/documentContext.js';
import DomElementFactory from '../../domUI/domElementFactory.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
// Mock the factory module itself for constructor tests, but we'll use real instances later
jest.mock('../../domUI/domElementFactory');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance; // To hold instance used in most tests
    let actionButtonsContainer; // The specific container for this renderer
    let mockSendButton; // Mock for the "Confirm Action" button
    const CLASS_PREFIX = '[ActionButtonsRenderer]'; // Define prefix for easier use in expects

    // --- Mock Elements ---
    // Creates a mock element with spied methods, letting JSDOM handle implementation
    // --- Mock Elements ---
    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName);
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            // Use the original classList.add before it's spied on for initial setup
            classArray.forEach(cls => element.classList.add(cls));
        }
        element.textContent = textContent;

        element._attributes = {};
        element._listeners = {};

        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) element._listeners[event] = [];
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn();

        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener();
                }
            }
        });

        const originalSetAttribute = element.setAttribute.bind(element);
        jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
            originalSetAttribute(name, value);
            element._attributes[name] = value;
        });

        // Make getAttribute also reflect the actual DOM attribute for consistency with querySelector
        const originalGetAttribute = element.getAttribute.bind(element);
        jest.spyOn(element, 'getAttribute').mockImplementation((name) => {
            // Test might still want to check _attributes for what was explicitly set via the spy,
            // but querySelector will use the actual DOM state.
            return originalGetAttribute(name);
        });
        // Store _attributes for direct test inspection if setAttribute was called
        // This is a bit redundant if getAttribute reads from DOM, but keeps existing test patterns if any rely on _attributes.
        // The important part is that setAttribute *actually sets the attribute on the DOM node*.

        jest.spyOn(element, 'remove');

        let isDisabled = false;
        if (tagName === 'button') {
            Object.defineProperty(element, 'disabled', {
                get: () => isDisabled,
                set: (value) => {
                    isDisabled = !!value;
                },
                configurable: true
            });
        }

        const actualClassList = element.classList;
        const originalClassListAdd = actualClassList.add.bind(actualClassList);
        const originalClassListRemove = actualClassList.remove.bind(actualClassList);
        const originalClassListContains = actualClassList.contains.bind(actualClassList);

        jest.spyOn(actualClassList, 'add').mockImplementation((...args) => {
            originalClassListAdd(...args);
        });
        jest.spyOn(actualClassList, 'remove').mockImplementation((...args) => {
            originalClassListRemove(...args);
        });
        jest.spyOn(actualClassList, 'contains').mockImplementation((...args) => {
            return originalClassListContains(...args);
        });

        // No need to redefine element.classList if we're spying on the methods of the original 'actualClassList' object.
        // Object.defineProperty(element, 'classList', { get: () => actualClassList, configurable: true });
        // This line is fine as it ensures that element.classList always returns the object whose methods are spied upon.

        return element;
    };


    beforeEach(() => {
        // Reset DOM with the *correct* ID for the container and send button
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="player-confirm-turn-button"></button></div></body></html>`);
        document = dom.window.document;
        global.document = document; // Ensure global document is set for DocumentContext
        global.HTMLElement = dom.window.HTMLElement; // Ensure global HTMLElement is set
        global.HTMLButtonElement = dom.window.HTMLButtonElement; // CRITICAL FIX: Ensure global HTMLButtonElement is set from JSDOM
        global.HTMLInputElement = dom.window.HTMLInputElement; // Also for speech input

        docContext = new DocumentContext(); // Let it pick up global.document

        mockLogger = new ConsoleLogger();
        // Ensure VED mock has necessary methods if not fully mocked elsewhere
        mockVed = new ValidatedEventDispatcher({
            eventBus: {subscribe: jest.fn(), unsubscribe: jest.fn(), dispatch: jest.fn().mockResolvedValue(undefined)}, // Basic EventBus mock
            gameDataRepository: {getEventDefinition: jest.fn()}, // Mock needed methods
            schemaValidator: {
                isSchemaLoaded: jest.fn().mockReturnValue(true),
                validate: jest.fn().mockReturnValue({isValid: true})
            }, // Mock needed methods
            logger: mockLogger // Use the mocked logger
        });

        // Create an *actual* factory instance for most tests, using the real constructor
        // Keep the module mock for the specific constructor failure test
        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        // Spy on the 'button' method of this *instance* for render tests
        jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            // Use our extended mock creator to get elements with spied methods
            return createMockElement('button', '', classes, text);
        });


        actionButtonsContainer = document.getElementById('action-buttons');
        // Use createMockElement for mockSendButton to ensure it has all mocked properties/methods
        // Align ID with the one the constructor queries as a fallback
        mockSendButton = createMockElement('button', 'player-confirm-turn-button');


        // Ensure container exists before spying
        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        // Logger spies
        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        // VED spies (re-apply spies on the potentially new mock instance)
        jest.spyOn(mockVed, 'subscribe').mockReturnValue({unsubscribe: jest.fn()});
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);
        jest.spyOn(mockVed, 'unsubscribe'); // Spy on unsubscribe as well


        // Spy on container's methods we want to track calls for, but DO NOT mock implementation
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild'); // Spy only, let JSDOM handle removal
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Clean up JSDOM globals if necessary
        delete global.document;
        delete global.HTMLElement;
        delete global.HTMLButtonElement; // Clean up added global
        delete global.HTMLInputElement; // Clean up added global
        if (document && document.body) {
            document.body.innerHTML = ''; // Clear body
        }
    });

    // Helper to create renderer
    const createRenderer = (
        containerOverride = actionButtonsContainer,
        factoryOverride = mockDomElementFactoryInstance,
        sendButtonOverride = mockSendButton // Add sendButtonOverride
    ) => {
        // Ensure speech input exists for tests that might rely on it,
        // or ensure tests mock documentContext.query if they don't want it.
        if (!docContext.query('#command-input')) {
            const mockInput = createMockElement('input', 'command-input');
            // @ts-ignore
            mockInput.value = ''; // ensure it has a value property
            document.body.appendChild(mockInput); // Add to JSDOM so query can find it
        }


        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride, // Pass the send button
        });
    };

    describe('Button Click Simulation', () => {
        // THIS TEST IS RENAMED AND REWRITTEN
        it('should select action, enable send button, and log selection on action button click', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect, {id: 'test:go_north', command: 'go north'}];

            const mockExamineButton = createMockElement('button', '', ['action-button'], 'examine');

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                let btn;
                if (text === 'examine') {
                    btn = mockExamineButton; // Use the specific mock instance
                } else {
                    btn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                }
                const actionForButton = actions.find(a => a.command === text);
                if (actionForButton) {
                    btn.setAttribute('data-action-id', actionForButton.id);
                }
                return btn;
            });

            const renderer = createRenderer();
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard
            expect(renderer.sendButtonElement.disabled).toBe(true);

            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(actionToSelect.command, 'action-button');
            expect(mockExamineButton.setAttribute).toHaveBeenCalledWith('data-action-id', actionToSelect.id);


            await mockExamineButton.click();

            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actionToSelect.command}' (ID: ${actionToSelect.id})`));
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
        });

        it('should update selection and button states when a different action is clicked', async () => {
            const action1 = {id: 'test:action1', command: 'Action 1'};
            const action2 = {id: 'test:action2', command: 'Action 2'};
            const actions = [action1, action2];

            const mockButton1 = createMockElement('button', '', ['action-button'], action1.command);
            const mockButton2 = createMockElement('button', '', ['action-button'], action2.command);

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                let btn;
                let actionId;
                if (text === action1.command) {
                    btn = mockButton1;
                    actionId = action1.id;
                } else if (text === action2.command) {
                    btn = mockButton2;
                    actionId = action2.id;
                } else {
                    btn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                    actionId = `generic:${text}`;
                }
                btn.setAttribute('data-action-id', actionId);
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard

            await mockButton1.click();
            expect(renderer.selectedAction).toEqual(action1);
            expect(mockButton1.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
            mockButton1.classList.add.mockClear();

            await mockButton2.click();
            expect(renderer.selectedAction).toEqual(action2);
            expect(mockButton1.classList.remove).toHaveBeenCalledWith('selected');
            expect(mockButton2.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
        });

        it('should deselect action if the same selected action button is clicked again', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect];
            const mockExamineButton = createMockElement('button', '', ['action-button'], 'examine');

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockExamineButton.setAttribute('data-action-id', actionToSelect.id);
                return mockExamineButton;
            });

            const renderer = createRenderer();
            renderer.render(actions);
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard


            await mockExamineButton.click();
            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
            mockExamineButton.classList.remove.mockClear();


            await mockExamineButton.click();
            expect(renderer.selectedAction).toBeNull();
            expect(mockExamineButton.classList.remove).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action deselected: '${actionToSelect.command}'`));
        });


        it('should NOT dispatch, and only log selection, if dispatchValidated would return false (action button click)', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false);

            const action = {id: 'test:inv', command: 'inventory'};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], action.command);
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockButton.setAttribute('data-action-id', action.id);
                return mockButton;
            });


            const renderer = createRenderer();
            renderer.render(actions);
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard
            expect(renderer.sendButtonElement.disabled).toBe(true);

            await mockButton.click();

            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actions[0].command}'`));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should NOT dispatch, and only log selection, if dispatchValidated would throw (action button click)', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError);

            const action = {id: 'test:help', command: 'help'};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], action.command);
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockButton.setAttribute('data-action-id', action.id);
                return mockButton;
            });


            const renderer = createRenderer();
            renderer.render(actions);
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard
            expect(renderer.sendButtonElement.disabled).toBe(true);

            await mockButton.click();

            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch"), testError);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actions[0].command}'`));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should select action and not dispatch, even if button textContent is empty at time of click (selection based on actionId)', async () => {
            const actionId = 'test:action1';
            const initialCommand = 'action1';
            const action = {id: actionId, command: initialCommand};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], initialCommand);

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                if (text === initialCommand) {
                    mockButton.setAttribute('data-action-id', actionId);
                    return mockButton;
                }
                const genericBtn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                genericBtn.setAttribute('data-action-id', `generic:${text}`);
                return genericBtn;
            });


            const renderer = createRenderer();
            renderer.render(actions);
            expect(renderer.sendButtonElement).not.toBeNull(); // Added guard


            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
            expect(mockButton.textContent).toBe(initialCommand);
            expect(mockButton.getAttribute('data-action-id')).toBe(actionId);
            expect(renderer.sendButtonElement.disabled).toBe(true);


            mockButton.textContent = '';
            expect(mockButton.textContent).toBe('');


            await mockButton.click();

            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`Action button clicked, but its textContent is unexpectedly empty or whitespace. ID: ${actionId}`)
            );
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(renderer.selectedAction).toEqual(action);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${initialCommand}'`));
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining("'sendButtonElement' (Confirm Action button) was not provided")
            );
        });
    });


    describe('VED Event Handling (textUI:update_available_actions)', () => {
        let updateActionsHandler;
        let mockSubscription;
        let rendererInstance;
        const eventType = 'textUI:update_available_actions';

        beforeEach(() => {
            mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockImplementation((name, handler) => {
                if (name === eventType) {
                    updateActionsHandler = handler;
                }
                return mockSubscription;
            });

            rendererInstance = createRenderer();

            if (!updateActionsHandler) {
                throw new Error(`Test setup failed: VED handler for '${eventType}' was not captured.`);
            }
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
            jest.spyOn(rendererInstance, 'render');
        });

        it('should call render with valid actions from payload', () => {
            const innerPayload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},
                    {id: 'core:go_s', command: 'south'},
                    {id: 'core:examine', command: 'examine room'},
                ]
            };
            const eventObject = {type: eventType, payload: innerPayload};

            updateActionsHandler(eventObject);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'. Event Object:`), eventObject);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(innerPayload.actions);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should call render with filtered valid action objects, logging a warning', () => {
            const innerPayload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},
                    null,
                    {id: 'core:go_s'},
                    {command: 'examine'},
                    {id: 'core:take', command: 'take sword'},
                    123,
                    {id: '', command: 'empty_id'},
                    {id: 'core:drop', command: '  '},
                    'a string',
                    {id: 'core:wait', command: 'wait'},
                    undefined,
                ]
            };
            const eventObject = {type: eventType, payload: innerPayload};
            const expectedFilteredActions = [
                {id: 'core:go_n', command: 'north'},
                {id: 'core:take', command: 'take sword'},
                {id: 'core:wait', command: 'wait'},
            ];

            updateActionsHandler(eventObject);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'. Event Object:`), eventObject);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array. Only valid action objects will be rendered. Original event object:`), eventObject);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFilteredActions);
        });

        it('should call render with empty list and log warning if payload is invalid', () => {
            const expectedEmptyActions = [];
            const expectedWarningBase = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`;

            const testCases = [
                null,
                {},
                {type: eventType, payload: {}},
                {type: eventType, payload: {actions: 'not-an-array'}},
                {type: eventType}
            ];

            testCases.forEach((inputCase, index) => {
                updateActionsHandler(inputCase);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(expectedWarningBase), inputCase);
                expect(rendererInstance.render).toHaveBeenCalledWith(expectedEmptyActions);
                rendererInstance.render.mockClear();
                mockLogger.warn.mockClear();
            });
            expect(rendererInstance.render).toHaveBeenCalledTimes(0);
        });
    });


    describe('dispose()', () => {
        it('should unsubscribe from VED event', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });

        it('should call base class dispose (logs message)', () => {
            const renderer = createRenderer();
            const baseDisposeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(renderer)), 'dispose');
            renderer.dispose();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
            expect(baseDisposeSpy).toHaveBeenCalled();
            baseDisposeSpy.mockRestore();
        });

        it('should handle multiple dispose calls gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });
    });

});