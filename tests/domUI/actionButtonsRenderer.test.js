// tests/domUI/actionButtonsRenderer.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../src/domUI/index.js'; // Using index import
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainer;
    let mockSendButton;
    let commandInputElement;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const PLAYER_TURN_SUBMITTED_EVENT = 'core:player_turn_submitted';
    const UPDATE_ACTIONS_EVENT_TYPE = 'textUI:update_available_actions';

    const createTestAction = (id, name, command, description) => ({id, name, command, description});

    const createMockElement = (sourceDocument, tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = sourceDocument.createElement(tagName);
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        classArray.forEach(cls => element.classList.add(cls));
        element.textContent = textContent;
        element._attributes = {};
        element._listeners = {};
        jest.spyOn(element, 'addEventListener').mockImplementation((event, cb) => {
            element._listeners[event] = element._listeners[event] || [];
            element._listeners[event].push(cb);
        });
        jest.spyOn(element, 'removeEventListener').mockImplementation((name, cb) => {
            if (element._listeners[name]) {
                element._listeners[name] = element._listeners[name].filter(fn => fn !== cb);
            }
        });
        const originalClick = typeof element.click === 'function' ? element.click.bind(element) : () => {
        };
        element.click = jest.fn(async () => {
            originalClick();
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) await listener();
            }
        });
        const originalSetAttribute = element.setAttribute.bind(element);
        jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
            originalSetAttribute(name, value);
            element._attributes[name] = value;
        });
        jest.spyOn(element, 'getAttribute');
        jest.spyOn(element, 'remove');
        if (tagName === 'button' || tagName === 'input') {
            let isDisabled = false;
            Object.defineProperty(element, 'disabled', {
                get: () => isDisabled,
                set: (value) => {
                    isDisabled = !!value;
                    if (isDisabled) originalSetAttribute('disabled', ''); else element.removeAttribute('disabled');
                },
                configurable: true
            });
        }
        if (tagName === 'input') {
            let currentValue = textContent || '';
            Object.defineProperty(element, 'value', {
                get: () => currentValue, set: (val) => {
                    currentValue = String(val);
                }, configurable: true
            });
            if (!Object.prototype.hasOwnProperty.call(element, 'type')) Object.defineProperty(element, 'type', {
                value: 'text',
                writable: true,
                configurable: true
            });
        }
        jest.spyOn(element.classList, 'add');
        jest.spyOn(element.classList, 'remove');
        jest.spyOn(element.classList, 'contains');
        return element;
    };

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="player-confirm-turn-button"></button><input type="text" id="speech-input" /></div></body></html>`);
        document = dom.window.document;
        global.document = document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;
        docContext = new DocumentContext(document);
        actionButtonsContainer = document.getElementById('action-buttons');
        const sendButtonElemOriginal = document.getElementById('player-confirm-turn-button');
        const speechInputElemOriginal = document.getElementById('speech-input');
        if (!actionButtonsContainer || !sendButtonElemOriginal || !speechInputElemOriginal) throw new Error("Test setup failed: Essential JSDOM elements not found.");
        mockSendButton = createMockElement(document, 'button', 'player-confirm-turn-button');
        sendButtonElemOriginal.parentNode.replaceChild(mockSendButton, sendButtonElemOriginal);
        commandInputElement = createMockElement(document, 'input', 'speech-input');
        commandInputElement.type = 'text';
        speechInputElemOriginal.parentNode.replaceChild(commandInputElement, speechInputElemOriginal);
        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});
        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        if (!jest.isMockFunction(mockDomElementFactoryInstance.button)) mockDomElementFactoryInstance.button = jest.fn();
        if (!jest.isMockFunction(mockDomElementFactoryInstance.create)) mockDomElementFactoryInstance.create = jest.fn();
        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => createMockElement(document, 'button', '', cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [], text));
        mockDomElementFactoryInstance.create.mockImplementation(tagName => document.createElement(tagName));
        const actualUnsubscribeFn = jest.fn();
        mockVed.subscribe.mockReturnValue(actualUnsubscribeFn);
        mockVed.dispatchValidated.mockResolvedValue(true);
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) document.body.innerHTML = '';
    });

    const createRenderer = (config = {}) => {
        const defaults = {
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactoryInstance,
            actionButtonsContainer: actionButtonsContainer,
            sendButtonElement: mockSendButton
        };
        return new ActionButtonsRenderer({...defaults, ...config});
    };

    // No longer need getUpdateActionsHandler as we will re-create renderer or call method directly if possible.

    // --- Constructor Tests (no changes needed from your last version) ---
    describe('Constructor', () => {
        it('should initialize and subscribe to VED events', () => {
            createRenderer();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Attached to action buttons container element:`), actionButtonsContainer);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} 'Confirm Action' button registered and click listener added:`), mockSendButton);
            expect(mockSendButton.disabled).toBe(true);
            expect(mockVed.subscribe).toHaveBeenCalledWith(UPDATE_ACTIONS_EVENT_TYPE, expect.any(Function));
        });
        // ... other constructor tests ...
        it('should throw if actionButtonsContainer is missing or invalid', () => {
            const factoryMock = new DomElementFactory(docContext);
            factoryMock.create = jest.fn();
            const expectedErrorMessage = `${CLASS_PREFIX} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
            expect(() => createRenderer({actionButtonsContainer: null, domElementFactory: factoryMock}))
                .toThrow(new RegExp(expectedErrorMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedErrorMessage), {receivedElement: null});
        });

        it('should warn if sendButtonElement is not found and fallback query fails', () => {
            const localJSDOM = new JSDOM(`<html><body><div id="action-buttons"></div><input type="text" id="speech-input"/></body></html>`);
            const localDoc = localJSDOM.window.document;
            const localContainer = localDoc.getElementById('action-buttons');
            const localCtx = {
                query: jest.fn(selector => (selector === '#player-confirm-turn-button' ? null : localDoc.querySelector(selector))),
                getElementById: jest.fn(id => localDoc.getElementById(id)),
                create: jest.fn(tagName => localDoc.createElement(tagName))
            };
            const factoryMock = new DomElementFactory(localCtx);
            factoryMock.create = jest.fn().mockReturnValue(localDoc.createElement('div'));
            factoryMock.button = jest.fn().mockReturnValue(localDoc.createElement('button'));
            createRenderer({
                documentContext: localCtx,
                actionButtonsContainer: localContainer,
                sendButtonElement: null,
                domElementFactory: factoryMock
            });
            const expectedWarningMsg = `${CLASS_PREFIX} 'Confirm Action' button ('#player-confirm-turn-button' or provided sendButtonElement) was not found or is not a valid button type. Confirm button functionality will be unavailable.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg, {candidate: null});
        });

        it('should warn if speech input element (#speech-input) is not found', () => {
            const domNoInput = new JSDOM(`<!DOCTYPE html><html><body><div id="action-buttons"></div><button id="player-confirm-turn-button"></button></body></html>`);
            const localDocument = domNoInput.window.document;
            const localDocCtx = new DocumentContext(localDocument);
            const localDomElementFactory = new DomElementFactory(localDocCtx);
            localDomElementFactory.create = jest.fn(tagName => localDocument.createElement(tagName));
            localDomElementFactory.button = jest.fn(tagName => localDocument.createElement('button'));
            const confirmButton = localDocument.getElementById('player-confirm-turn-button');
            createRenderer({
                documentContext: localDocCtx,
                domElementFactory: localDomElementFactory,
                actionButtonsContainer: localDocument.getElementById('action-buttons'),
                sendButtonElement: confirmButton
            });
            const expectedWarningMsg = `${CLASS_PREFIX} Speech input element ('#speech-input') not found or unusable. Speech input will be unavailable for submitted actions.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg, {queriedElement: null});
        });
    });

    // --- Button Click Simulation (Action Buttons) (no changes needed from your last version) ---
    describe('Button Click Simulation (Action Buttons)', () => {
        let renderer;
        let simulateUpdateActionsEventForCurrentRenderer;

        beforeEach(() => {
            // Crucial: Reset mock for subscribe for this describe block if it was changed globally
            const actualUnsubscribeFn = jest.fn();
            mockVed.subscribe.mockReset().mockReturnValue(actualUnsubscribeFn); // Reset and set default return

            renderer = createRenderer();

            // Helper specifically for this renderer instance
            simulateUpdateActionsEventForCurrentRenderer = (actorId, actions) => {
                const subscribeCall = mockVed.subscribe.mock.calls.find(call => call[0] === UPDATE_ACTIONS_EVENT_TYPE);
                if (subscribeCall && typeof subscribeCall[1] === 'function') {
                    const handler = subscribeCall[1];
                    handler({type: UPDATE_ACTIONS_EVENT_TYPE, payload: {actorId, actions}});
                } else {
                    throw new Error("Button Click Sim: Could not find registered handler for textUI:update_available_actions for the current renderer instance.");
                }
            };
        });

        // ... your existing tests in this block, using simulateUpdateActionsEventForCurrentRenderer ...
        it('should select action, enable send button, and log selection on action button click', async () => {
            const actionToSelect = createTestAction('test:examine', 'Examine Item', 'examine item', 'Examines the item closely.');
            const actions = [actionToSelect, createTestAction('test:go_north', 'Go North', 'go north', 'Moves your character to the north.')];
            const testActorId = 'player1';
            let mockExamineButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                if (text === actionToSelect.command) mockExamineButton = btn;
                const action = actions.find(a => a.command === text);
                if (action) btn.setAttribute('data-action-id', action.id);
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockExamineButton).toBeDefined();
            if (!mockExamineButton) return;
            expect(renderer.sendButtonElement.disabled).toBe(true);
            await mockExamineButton.click();
            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actionToSelect.name}' (ID: ${actionToSelect.id})`));
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
        });

        it('should update selection and button states when a different action is clicked', async () => {
            const action1 = createTestAction('test:action1', 'Action One', 'Perform Action 1', 'Description for Action 1.');
            const action2 = createTestAction('test:action2', 'Action Two', 'Perform Action 2', 'Description for Action 2.');
            const actions = [action1, action2];
            const testActorId = 'player1';
            let mockButton1, mockButton2;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                if (text === action1.command) mockButton1 = btn; else if (text === action2.command) mockButton2 = btn;
                const action = actions.find(a => a.command === text);
                if (action) btn.setAttribute('data-action-id', action.id);
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockButton1).toBeDefined();
            expect(mockButton2).toBeDefined();
            if (!mockButton1 || !mockButton2) return;
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
            const actionToSelect = createTestAction('test:examine', 'Examine Test', 'examine test object', 'Detailed examination.');
            const actions = [actionToSelect];
            const testActorId = 'player1';
            let mockExamineButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', actionToSelect.id);
                if (text === actionToSelect.command) mockExamineButton = btn;
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockExamineButton).toBeDefined();
            if (!mockExamineButton) return;
            await mockExamineButton.click();
            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
            mockExamineButton.classList.remove.mockClear();
            await mockExamineButton.click();
            expect(renderer.selectedAction).toBeNull();
            expect(mockExamineButton.classList.remove).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(true);
        });

        it('should call dispatchValidated, then log error, when dispatchValidated returns false (send button click)', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false);
            const action = createTestAction('test:inv', 'Inventory', 'open inventory', 'Opens the player inventory.');
            const actions = [action];
            const testActorId = 'player-inventory';
            let mockButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', action.id);
                if (text === action.command) mockButton = btn;
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockButton).toBeDefined();
            if (!mockButton) return;
            await mockButton.click();
            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            await mockSendButton.click();
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_EVENT, expect.objectContaining({
                submittedByActorId: testActorId,
                actionId: action.id
            }));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_EVENT}' for action ID '${action.id}'. dispatchValidated returned false.`), expect.anything());
            expect(renderer.selectedAction).toEqual(action);
            expect(renderer.sendButtonElement.disabled).toBe(false);
        });

        it('should call dispatchValidated, then log error, when dispatchValidated throws (send button click)', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError);
            const action = createTestAction('test:help', 'Help', 'get help', 'Displays help information.');
            const actions = [action];
            const testActorId = 'player-help';
            let mockButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', action.id);
                if (text === action.command) mockButton = btn;
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockButton).toBeDefined();
            if (!mockButton) return;
            await mockButton.click();
            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            await mockSendButton.click();
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_EVENT, expect.objectContaining({
                submittedByActorId: testActorId,
                actionId: action.id
            }));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_EVENT}' (Action ID: ${action.id})`), expect.objectContaining({error: testError}));
            expect(renderer.selectedAction).toEqual(action);
            expect(renderer.sendButtonElement.disabled).toBe(false);
        });

        it('should select action and not dispatch, even if button textContent is empty at time of click (selection based on actionId)', async () => {
            const actionId = 'test:action1';
            const initialCommand = 'action1 command';
            const action = createTestAction(actionId, 'Action One Name', initialCommand, 'Desc for action1');
            const actions = [action];
            const testActorId = 'player1';
            let mockButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                const correspondingAction = actions.find(a => a.command === text);
                if (correspondingAction) {
                    btn.setAttribute('data-action-id', correspondingAction.id);
                    if (correspondingAction.id === actionId) mockButton = btn;
                } else {
                    btn.setAttribute('data-action-id', `generic:${text.replace(/\s+/g, '_')}`);
                }
                return btn;
            });
            simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
            expect(mockButton).toBeDefined();
            if (!mockButton) return;
            expect(mockButton.textContent).toBe(initialCommand);
            expect(mockButton.getAttribute('data-action-id')).toBe(actionId);
            expect(renderer.sendButtonElement.disabled).toBe(true);
            mockButton.textContent = '';
            await mockButton.click();
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(renderer.selectedAction).toEqual(action);
            expect(renderer.sendButtonElement.disabled).toBe(false);
        });
    });


    describe('VED Event Handling (textUI:update_available_actions)', () => {
        let rendererInstance;
        let capturedUpdateActionsHandler;

        beforeEach(() => {
            const mockSubscriptionUnsubscribe = jest.fn();
            // Crucial: Reset subscribe mock for each test in THIS describe block
            // to ensure 'capturedUpdateActionsHandler' is specific to 'rendererInstance' of this block.
            mockVed.subscribe.mockReset().mockImplementation((eventName, handler) => {
                if (eventName === UPDATE_ACTIONS_EVENT_TYPE) {
                    capturedUpdateActionsHandler = handler; // Capture the handler specific to the instance created below
                }
                return mockSubscriptionUnsubscribe;
            });

            mockLogger.warn.mockClear();
            rendererInstance = createRenderer(); // Creates instance and its constructor subscribes

            if (typeof capturedUpdateActionsHandler !== 'function') {
                throw new Error(`Test setup for VED Event Handling failed: VED handler for '${UPDATE_ACTIONS_EVENT_TYPE}' was not captured for this test run.`);
            }
            jest.spyOn(rendererInstance, 'render');
        });

        it('should call render with valid actions from payload and set currentActorId', () => {
            const testActorId = 'player-test-actor-valid';
            const validAction = createTestAction('core:go_n', 'Go North', 'go north', 'Move northwards.');
            const innerPayload = {actorId: testActorId, actions: [validAction]};
            const eventObject = {type: UPDATE_ACTIONS_EVENT_TYPE, payload: innerPayload};

            mockLogger.warn.mockClear();
            capturedUpdateActionsHandler(eventObject); // Invoke the captured handler

            expect(rendererInstance.render).toHaveBeenCalledWith(innerPayload.actions);
            expect(rendererInstance._getTestCurrentActorId()).toBe(testActorId);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Actions received for actor ID: ${testActorId}`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should call render with filtered valid action objects, logging a warning, and set currentActorId', () => {
            const testActorId = 'player-test-actor-filter';
            const validAction1 = createTestAction('core:go_n', 'Go North', 'go north', 'Move northwards.');
            const validAction2 = createTestAction('valid:action', 'Do Valid Thing', 'Do it well', 'This is a valid description.');
            const actionMissingDesc = {id: 'invalid:desc', name: 'No Desc', command: 'no desc cmd'};
            const actionMissingName = {id: 'invalid:name', command: 'no name cmd', description: 'No name desc'};

            const innerPayload = {
                actorId: testActorId,
                actions: [validAction1, null, validAction2, actionMissingDesc, actionMissingName, {
                    id: 'core:empty_cmd',
                    name: 'Empty Cmd',
                    command: ' ',
                    description: 'Test'
                }]
            };
            const eventObject = {type: UPDATE_ACTIONS_EVENT_TYPE, payload: innerPayload};
            const expectedFiltered = [validAction1, validAction2];

            mockLogger.warn.mockClear();
            capturedUpdateActionsHandler(eventObject);

            expect(rendererInstance._getTestCurrentActorId()).toBe(testActorId);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Actions received for actor ID: ${testActorId}`
            );
            const overallWarningMsg = `${CLASS_PREFIX} Received '${UPDATE_ACTIONS_EVENT_TYPE}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(overallWarningMsg, {originalEvent: eventObject});
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFiltered);
        });

        it('should call render with empty list and log warning if payload is invalid (e.g. missing actorId)', () => {
            const testCases = [null, {}, {
                type: UPDATE_ACTIONS_EVENT_TYPE,
                payload: {}
            }, {type: UPDATE_ACTIONS_EVENT_TYPE, payload: {actions: 'invalid'}}, {
                type: UPDATE_ACTIONS_EVENT_TYPE,
                payload: {actions: [createTestAction('id', 'n', 'c', 'd')]}
            }];

            testCases.forEach(inputCase => {
                rendererInstance.render.mockClear();
                mockLogger.warn.mockClear();

                // 1. Set a known initial state for #currentActorId using a valid event
                const initialActorId = 'some-previous-actor';
                const initialActions = [createTestAction('initial:id', 'Initial Name', 'initial_cmd', 'Initial Desc')];
                capturedUpdateActionsHandler({
                    type: UPDATE_ACTIONS_EVENT_TYPE,
                    payload: {actorId: initialActorId, actions: initialActions}
                });

                // 2. Verify that the initial state was set correctly (this is the failing line from previous output)
                expect(rendererInstance._getTestCurrentActorId()).toBe(initialActorId);

                // 3. Now, call with the invalid inputCase
                capturedUpdateActionsHandler(inputCase);

                const eventTypeForLog = inputCase && typeof inputCase.type === 'string' ? inputCase.type : UPDATE_ACTIONS_EVENT_TYPE;
                const expectedWarningMsg = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actorId: '...', actions: [...] } }. Clearing action buttons.`;
                expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg, {receivedObject: inputCase});
                expect(rendererInstance.render).toHaveBeenCalledWith([]);
                // 4. Verify that #currentActorId is now null
                expect(rendererInstance._getTestCurrentActorId()).toBeNull();
            });
        });
    });
});