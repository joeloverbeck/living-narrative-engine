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
// Mock the factory module itself. Instances will be auto-mocks unless implemented.
jest.mock('../../domUI/domElementFactory');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document; // JSDOM document
    let docContext; // Main DocumentContext for most tests
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance; // Main DomElementFactory mock instance
    let actionButtonsContainer;
    let mockSendButton;
    let commandInputElement;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const PLAYER_TURN_SUBMITTED_EVENT = 'core:player_turn_submitted';

    const createMockElement = (sourceDocument, tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = sourceDocument.createElement(tagName); // Use provided document
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            classArray.forEach(cls => element.classList.add(cls));
        }
        element.textContent = textContent;

        element._attributes = {};
        element._listeners = {};

        jest.spyOn(element, 'addEventListener').mockImplementation((event, cb) => {
            if (!element._listeners[event]) element._listeners[event] = [];
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

        jest.spyOn(element, 'getAttribute');
        jest.spyOn(element, 'remove');

        if (tagName === 'button' || tagName === 'input') {
            let isDisabled = false;
            Object.defineProperty(element, 'disabled', {
                get: () => isDisabled,
                set: (value) => {
                    isDisabled = !!value;
                    if (isDisabled) {
                        originalSetAttribute('disabled', '');
                    } else {
                        element.removeAttribute('disabled');
                    }
                },
                configurable: true
            });
        }
        if (tagName === 'input') {
            let currentValue = textContent || '';
            Object.defineProperty(element, 'value', {
                get: () => currentValue,
                set: (val) => {
                    currentValue = String(val);
                },
                configurable: true
            });
            // Ensure 'type' property is available if needed for instanceof HTMLInputElement checks,
            // though JSDOM handles this for createElement('input')
            if (!Object.prototype.hasOwnProperty.call(element, 'type')) {
                Object.defineProperty(element, 'type', {
                    value: 'text', // Default type
                    writable: true,
                    configurable: true
                });
            }
        }

        jest.spyOn(element.classList, 'add');
        jest.spyOn(element.classList, 'remove');
        jest.spyOn(element.classList, 'contains');

        return element;
    };


    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="game-container">
                <div id="action-buttons"></div>
                <button id="player-confirm-turn-button"></button>
                <input type="text" id="command-input" />
            </div>
        </body></html>`);
        document = dom.window.document;
        global.document = document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;

        docContext = new DocumentContext(document);

        actionButtonsContainer = document.getElementById('action-buttons');
        const sendButtonElemOriginal = document.getElementById('player-confirm-turn-button');
        const commandInputElemOriginal = document.getElementById('command-input');

        if (!actionButtonsContainer || !sendButtonElemOriginal || !commandInputElemOriginal) {
            throw new Error("Test setup failed: Essential JSDOM elements not found.");
        }

        mockSendButton = createMockElement(document, 'button', 'player-confirm-turn-button');
        sendButtonElemOriginal.parentNode.replaceChild(mockSendButton, sendButtonElemOriginal);

        commandInputElement = createMockElement(document, 'input', 'command-input');
        commandInputElement.type = 'text'; // Ensure type is set on the mock
        commandInputElemOriginal.parentNode.replaceChild(commandInputElement, commandInputElemOriginal);

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});

        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        if (!jest.isMockFunction(mockDomElementFactoryInstance.button)) {
            mockDomElementFactoryInstance.button = jest.fn();
        }
        if (!jest.isMockFunction(mockDomElementFactoryInstance.create)) {
            mockDomElementFactoryInstance.create = jest.fn();
        }

        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            return createMockElement(document, 'button', '', classes, text);
        });
        mockDomElementFactoryInstance.create.mockImplementation(tagName => document.createElement(tagName));

        mockVed.subscribe.mockReturnValue({unsubscribe: jest.fn()});
        mockVed.dispatchValidated.mockResolvedValue(true);

        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) {
            document.body.innerHTML = '';
        }
    });

    const createRenderer = (config = {}) => {
        const defaults = {
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactoryInstance,
            actionButtonsContainer: actionButtonsContainer,
            sendButtonElement: mockSendButton,
        };
        return new ActionButtonsRenderer({...defaults, ...config});
    };

    describe('Constructor', () => {
        it('should initialize and subscribe to VED events', () => {
            createRenderer();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Attached to action buttons container element:`), actionButtonsContainer);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} 'Confirm Action' button registered and click listener added:`), mockSendButton);
            expect(mockSendButton.disabled).toBe(true);
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:update_available_actions', expect.any(Function));
        });

        it('should throw if actionButtonsContainer is missing or invalid', () => {
            const factoryMock = new DomElementFactory(docContext);
            factoryMock.create = jest.fn(); // Ensure factory is minimally valid for other checks

            const expectedErrorMessage = `${CLASS_PREFIX} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;

            expect(() => createRenderer({
                actionButtonsContainer: null,
                domElementFactory: factoryMock // Provide a valid factory to isolate container issue
            })).toThrow(new RegExp(expectedErrorMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedErrorMessage),
                {receivedElement: null}
            );
        });

        it('should warn if sendButtonElement is not found and fallback query fails', () => {
            const localJSDOM = new JSDOM(`<html><body><div id="action-buttons"></div></body></html>`);
            const localDoc = localJSDOM.window.document;
            const localContainer = localDoc.getElementById('action-buttons');
            const localCtx = {
                query: jest.fn(selector => {
                    if (selector === '#player-confirm-turn-button') return null;
                    if (selector === '#command-input') return null; // Ensure speech input also not found for this specific setup
                    return localDoc.querySelector(selector);
                }),
                getElementById: jest.fn(id => localDoc.getElementById(id)),
                create: jest.fn(tagName => localDoc.createElement(tagName))
            };
            const factoryMock = new DomElementFactory(localCtx);
            // Ensure the factory mock has the necessary methods to avoid unrelated errors
            factoryMock.create = jest.fn().mockReturnValue(localDoc.createElement('div'));
            factoryMock.button = jest.fn().mockReturnValue(localDoc.createElement('button'));


            createRenderer({
                documentContext: localCtx,
                actionButtonsContainer: localContainer,
                sendButtonElement: null, // Explicitly pass null
                domElementFactory: factoryMock
            });

            const expectedWarningMsg = `${CLASS_PREFIX} 'Confirm Action' button ('#player-confirm-turn-button' or provided sendButtonElement) was not found or is not a valid button type. Confirm button functionality will be unavailable.`;
            // This warning should be the first one if speech input is also missing.
            // Or, if we ensure speech input *is* found, this would be the only one.
            // Given the Jest output, both occur. We're interested in the confirm button warning here.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expectedWarningMsg,
                {candidate: null}
            );
        });


        it('should warn if speech input element (#command-input) is not found', () => {
            const domNoInput = new JSDOM(`<!DOCTYPE html><html><body>
                <div id="action-buttons"></div>
                <button id="player-confirm-turn-button"></button>
            </body></html>`);
            const localDocument = domNoInput.window.document;
            const localDocCtx = new DocumentContext(localDocument); // Uses querySelector from JSDOM

            const localDomElementFactory = new DomElementFactory(localDocCtx);
            localDomElementFactory.create = jest.fn(tagName => localDocument.createElement(tagName));
            localDomElementFactory.button = jest.fn(tagName => localDocument.createElement('button'));

            const confirmButton = localDocument.getElementById('player-confirm-turn-button');
            // We need to mock methods on this specific button if it's used by the constructor logic
            // For this test, ensure it's a valid button to avoid other warnings.
            // The createMockElement might be better here if deeper interaction is needed.
            // For now, assuming basic JSDOM element is enough if only `instanceof HTMLButtonElement` is checked.


            createRenderer({
                documentContext: localDocCtx,
                domElementFactory: localDomElementFactory,
                actionButtonsContainer: localDocument.getElementById('action-buttons'),
                sendButtonElement: confirmButton // Provide the existing confirm button
            });

            // The actual message includes "or unusable"
            const expectedWarningMsg = `${CLASS_PREFIX} Speech input element ('#command-input') not found or unusable. Speech input will be unavailable for submitted actions.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expectedWarningMsg,
                {queriedElement: null} // JSDOM query for non-existent #command-input returns null
            );
        });
    });

    describe('Button Click Simulation (Action Buttons)', () => {
        it('should select action, enable send button, and log selection on action button click', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect, {id: 'test:go_north', command: 'go north'}];

            let mockExamineButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                if (text === actionToSelect.command) {
                    mockExamineButton = btn;
                }
                const action = actions.find(a => a.command === text);
                if (action) {
                    btn.setAttribute('data-action-id', action.id);
                }
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockExamineButton).toBeDefined();
            if (!mockExamineButton) return;

            expect(renderer.sendButtonElement.disabled).toBe(true);
            await mockExamineButton.click();

            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actionToSelect.command}' (ID: ${actionToSelect.id})`));
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
        });

        it('should update selection and button states when a different action is clicked', async () => {
            const action1 = {id: 'test:action1', command: 'Action 1'};
            const action2 = {id: 'test:action2', command: 'Action 2'};
            const actions = [action1, action2];

            let mockButton1, mockButton2;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                if (text === action1.command) mockButton1 = btn;
                else if (text === action2.command) mockButton2 = btn;
                const action = actions.find(a => a.command === text);
                if (action) btn.setAttribute('data-action-id', action.id);
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);

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
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect];
            let mockExamineButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', actionToSelect.id);
                if (text === actionToSelect.command) mockExamineButton = btn;
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);
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


        it('should NOT dispatch, and only log selection, if dispatchValidated would return false (action button click)', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false);

            const action = {id: 'test:inv', command: 'inventory'};
            const actions = [action];
            let mockButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', action.id);
                if (text === action.command) mockButton = btn;
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);
            expect(mockButton).toBeDefined();
            if (!mockButton) return;

            expect(renderer.sendButtonElement.disabled).toBe(true);
            await mockButton.click();

            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });

        it('should NOT dispatch, and only log selection, if dispatchValidated would throw (action button click)', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError);

            const action = {id: 'test:help', command: 'help'};
            const actions = [action];
            let mockButton;
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                btn.setAttribute('data-action-id', action.id);
                if (text === action.command) mockButton = btn;
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);
            expect(mockButton).toBeDefined();
            if (!mockButton) return;

            expect(renderer.sendButtonElement.disabled).toBe(true);
            await mockButton.click();

            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false);
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });

        it('should select action and not dispatch, even if button textContent is empty at time of click (selection based on actionId)', async () => {
            const actionId = 'test:action1';
            const initialCommand = 'action1';
            const action = {id: actionId, command: initialCommand};
            const actions = [action];
            let mockButton;

            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const btn = createMockElement(document, 'button', '', cls ? cls.split(' ') : [], text);
                if (text === initialCommand) {
                    btn.setAttribute('data-action-id', actionId);
                    mockButton = btn;
                } else {
                    btn.setAttribute('data-action-id', `generic:${text}`);
                }
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);
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
        let updateActionsHandler;
        let rendererInstance;
        const eventType = 'textUI:update_available_actions';

        beforeEach(() => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockImplementation((name, handler) => {
                if (name === eventType) {
                    updateActionsHandler = handler;
                }
                return mockSubscription;
            });

            // mockLogger.warn might have been called by the constructor of rendererInstance
            // Clear it here IF the constructor's warnings are not relevant to every test in this block.
            // Alternatively, clear it at the beginning of each 'it' block if constructor behavior varies.
            mockLogger.warn.mockClear(); // Clear any warnings from constructor

            rendererInstance = createRenderer(); // This might log warnings (e.g. speech input if not found in default setup)
            // So, clear again or be specific in tests.

            if (!updateActionsHandler) {
                throw new Error(`Test setup for VED Event Handling failed: VED handler for '${eventType}' was not captured.`);
            }
            jest.spyOn(rendererInstance, 'render');
        });

        it('should call render with valid actions from payload', () => {
            const innerPayload = {
                actions: [{id: 'core:go_n', command: 'north'}]
            };
            const eventObject = {type: eventType, payload: innerPayload};

            mockLogger.warn.mockClear(); // Ensure clean slate for this test's specific action
            updateActionsHandler(eventObject);

            expect(rendererInstance.render).toHaveBeenCalledWith(innerPayload.actions);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning should occur for valid payload
        });

        it('should call render with filtered valid action objects, logging a warning', () => {
            const innerPayload = {
                actions: [{id: 'core:go_n', command: 'north'}, null, {id: 'valid:action', command: 'Do it'}]
            };
            const eventObject = {type: eventType, payload: innerPayload};
            const expectedFiltered = [innerPayload.actions[0], innerPayload.actions[2]];

            // Clear any previous warnings (e.g., from constructor if createRenderer was just called)
            // The beforeEach for this describe block already creates rendererInstance,
            // which uses the global mockLogger.
            // Depending on the default JSDOM setup for `commandInputElement` in the outer beforeEach,
            // the constructor might log a warning for missing speech input.
            mockLogger.warn.mockClear();

            updateActionsHandler(eventObject);

            const expectedWarningMsg = `${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expectedWarningMsg,
                {originalEvent: eventObject}
            );
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFiltered);
        });

        it('should call render with empty list and log warning if payload is invalid', () => {
            const testCases = [
                null,
                {},
                {type: eventType, payload: {}}, // payload missing 'actions' array
                {type: eventType, payload: {actions: 'invalid'}} // actions is not an array
            ];

            testCases.forEach(inputCase => {
                rendererInstance.render.mockClear();
                mockLogger.warn.mockClear(); // Clear before each test case invocation

                updateActionsHandler(inputCase);

                // Determine the eventTypeForLog as it would be in the method
                const eventTypeForLog = inputCase && typeof inputCase.type === 'string' ? inputCase.type : eventType;

                const expectedWarningMsg = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons.`;
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expectedWarningMsg,
                    {receivedObject: inputCase}
                );
                expect(rendererInstance.render).toHaveBeenCalledWith([]);
            });
        });
    });
});