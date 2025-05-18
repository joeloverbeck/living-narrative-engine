// src/tests/domUI/actionButtonsRenderer.confirmActionButton.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {ActionButtonsRenderer} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext.js';
import DomElementFactory from '../../domUI/domElementFactory.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
jest.mock('../../domUI/domElementFactory');

describe('ActionButtonsRenderer', () => {
    let dom;
    let currentDocument;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainer;
    let mockSendButton;
    let commandInputElement;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const PLAYER_TURN_SUBMITTED_EVENT = 'core:player_turn_submitted';

    const createMockElement = (sourceDoc, tagName = 'div', id = '', classesParam = [], textContent = '') => {
        const element = sourceDoc.createElement(tagName);
        if (id) element.id = id;
        element.textContent = textContent;

        // Spy on classList methods BEFORE adding initial classes
        if (element.classList) {
            jest.spyOn(element.classList, 'add');
            jest.spyOn(element.classList, 'remove');
            jest.spyOn(element.classList, 'contains');
            jest.spyOn(element.classList, 'toggle');
        } else {
            console.warn(`Element of type ${tagName} does not have a classList property to spy on.`);
            element.classList = {
                add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn(), length: 0, toString: () => ""
            };
        }

        // Add initial classes passed via parameter. This will use the spied 'add' method.
        if (classesParam && classesParam.length > 0) {
            element.classList.add(...classesParam);
        }

        element._attributes = {};
        element._listeners = {};

        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) element._listeners[event] = [];
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn((name, cb) => {
            if (element._listeners && element._listeners[name]) {
                element._listeners[name] = element._listeners[name].filter(fn => fn !== cb);
            }
        });
        element.click = jest.fn(async () => {
            const listeners = element._listeners ? (element._listeners['click'] || []) : [];
            for (const listener of listeners) {
                await listener();
            }
        });

        const originalSetAttribute = element.setAttribute.bind(element);
        jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
            originalSetAttribute(name, value);
            element._attributes[name] = value;
        });

        const originalGetAttribute = element.getAttribute.bind(element);
        jest.spyOn(element, 'getAttribute').mockImplementation((name) => {
            if (name === 'data-action-id' && name in element._attributes) return element._attributes[name]; // Prioritize our tracking for this
            if (name in element._attributes && !(name === 'class' || name === 'style')) return element._attributes[name]; // Avoid overriding class/style from JSDOM via _attributes
            return originalGetAttribute(name);
        });

        const originalRemoveAttribute = element.removeAttribute.bind(element);
        jest.spyOn(element, 'removeAttribute').mockImplementation((name) => {
            originalRemoveAttribute(name);
            delete element._attributes[name];
        });

        jest.spyOn(element, 'remove');

        if (tagName === 'button' || tagName === 'input') {
            let isDisabled = false;
            Object.defineProperty(element, 'disabled', {
                get: () => isDisabled,
                set: (value) => {
                    isDisabled = !!value;
                    if (isDisabled) originalSetAttribute('disabled', '');
                    else originalRemoveAttribute('disabled');
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
            element.type = 'text';
        }

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
        currentDocument = dom.window.document;
        global.document = currentDocument;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;

        jest.clearAllMocks(); // Clears call counts etc. for all mocks. Spies might need restore.

        docContext = new DocumentContext(currentDocument);
        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});
        mockDomElementFactoryInstance = new DomElementFactory(docContext);

        mockVed.subscribe.mockReturnValue({unsubscribe: jest.fn()});
        mockVed.dispatchValidated.mockResolvedValue(true);

        // This mockImplementation creates elements using our `createMockElement`
        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
            // cls here is expected to be 'action-button'
            const classesArray = Array.isArray(cls) ? cls : (cls ? cls.split(' ').filter(c => c) : []);
            return createMockElement(currentDocument, 'button', '', classesArray, text);
        });
        mockDomElementFactoryInstance.create.mockImplementation(tagName => currentDocument.createElement(tagName));

        actionButtonsContainer = currentDocument.getElementById('action-buttons');
        if (!actionButtonsContainer) {
            throw new Error("Critical Test Setup Failed: #action-buttons container not found in JSDOM.");
        }

        const sendButtonOriginal = currentDocument.getElementById('player-confirm-turn-button');
        mockSendButton = createMockElement(currentDocument, 'button', 'player-confirm-turn-button');
        if (sendButtonOriginal && sendButtonOriginal.parentNode) {
            sendButtonOriginal.parentNode.replaceChild(mockSendButton, sendButtonOriginal);
        } else {
            currentDocument.body.appendChild(mockSendButton);
        }

        const commandInputOriginal = currentDocument.getElementById('command-input');
        commandInputElement = createMockElement(currentDocument, 'input', 'command-input', [], '');
        if (commandInputOriginal && commandInputOriginal.parentNode) {
            commandInputOriginal.parentNode.replaceChild(commandInputElement, commandInputOriginal);
        } else {
            currentDocument.body.appendChild(commandInputElement);
        }
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original implementations of spied functions
        if (dom) {
            dom.window.close();
            dom = null;
        }
        currentDocument = null;
    });

    const createRendererUnderTest = (rendererConfig = {}, customDocContext) => {
        const defaults = {
            logger: mockLogger,
            documentContext: customDocContext || docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactoryInstance,
            actionButtonsContainer: actionButtonsContainer,
            sendButtonElement: mockSendButton,
        };
        return new ActionButtonsRenderer({...defaults, ...rendererConfig});
    };

    describe('Confirm Action Button (#handleSendAction)', () => {
        const actionToSubmit = {id: 'core:submit_me', command: 'Submit This'};
        const actions = [actionToSubmit];
        let renderer;
        let actionButtonInstance;
        let specificTestDocContext;

        beforeEach(async () => {
            specificTestDocContext = {
                ...docContext,
                query: jest.fn(selector => {
                    if (selector === '#command-input') {
                        return commandInputElement;
                    }
                    return currentDocument.querySelector(selector);
                }),
                getElementById: jest.fn(id => currentDocument.getElementById(id)),
                create: jest.fn(tagName => currentDocument.createElement(tagName)),
            };

            // This ensures actionButtonInstance is the one with spied classList methods
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                const classesArray = Array.isArray(cls) ? cls : (cls ? cls.split(' ').filter(c => c) : []);
                const btn = createMockElement(currentDocument, 'button', '', classesArray, text);
                if (text === actionToSubmit.command) {
                    actionButtonInstance = btn;
                    btn.setAttribute('data-action-id', actionToSubmit.id);
                } else {
                    const otherAction = actions.find(a => a.command === text);
                    if (otherAction) btn.setAttribute('data-action-id', otherAction.id);
                }
                return btn;
            });

            renderer = createRendererUnderTest({}, specificTestDocContext);
            renderer.render(actions);

            if (!actionButtonInstance) {
                throw new Error(`Test setup error: actionButtonInstance for command '${actionToSubmit.command}' was not created.`);
            }

            ['info', 'error', 'debug', 'warn'].forEach(level => mockLogger[level].mockClear());
            mockVed.dispatchValidated.mockClear();

            // Clear classList spies for actionButtonInstance before the selection click
            // This ensures we only test calls made *after* this point if needed,
            // or calls made specifically by the selection logic.
            if (actionButtonInstance && actionButtonInstance.classList) {
                actionButtonInstance.classList.add.mockClear();
                actionButtonInstance.classList.remove.mockClear();
            }

            await actionButtonInstance.click(); // Select the action. This should call actionButtonInstance.classList.add('selected')

            expect(renderer.selectedAction).toEqual(actionToSubmit);
            expect(mockSendButton.disabled).toBe(false);
            // Verify that 'selected' class was added
            expect(actionButtonInstance.classList.add).toHaveBeenCalledWith('selected');


            ['info', 'error', 'debug', 'warn'].forEach(level => mockLogger[level].mockClear());
            mockVed.dispatchValidated.mockClear();
            // Clear classList spies again before the main action of the test (sendButton.click)
            if (actionButtonInstance && actionButtonInstance.classList) {
                actionButtonInstance.classList.add.mockClear();
                actionButtonInstance.classList.remove.mockClear();
            }
        });

        it('should dispatch event with actionId and speech, clear speech, deselect, and disable send button on successful dispatch', async () => {
            commandInputElement.value = 'Player says this';
            mockVed.dispatchValidated.mockResolvedValue(true);

            await mockSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_EVENT,
                {actionId: actionToSubmit.id, speech: 'Player says this'}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Event '${PLAYER_TURN_SUBMITTED_EVENT}' dispatched successfully for action ID '${actionToSubmit.id}'.`));
            expect(commandInputElement.value).toBe('');
            expect(renderer.selectedAction).toBeNull();
            expect(mockSendButton.disabled).toBe(true);

            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).toHaveBeenCalledWith('selected');
            } else {
                throw new Error("actionButtonInstance or its classList.remove spy is not defined for assertion.");
            }
        });

        // ... (the rest of the tests in this describe block should also now work correctly
        //      assuming their primary failure was related to classList interactions or speech,
        //      but they were passing in the last output except for the first one.)
        //      I will keep the previously corrected versions of those tests.

        it('should dispatch event with speech: null if speech input is empty', async () => {
            commandInputElement.value = '';
            mockVed.dispatchValidated.mockResolvedValue(true);

            await mockSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_EVENT,
                {actionId: actionToSubmit.id, speech: null}
            );
            expect(commandInputElement.value).toBe('');
        });

        it('should dispatch event with speech: null and log warning if speech input element is missing post-construction', async () => {
            const localDocContextNoSpeech = {
                ...specificTestDocContext,
                query: (selector) => selector === '#command-input' ? null : specificTestDocContext.query(selector),
            };

            const rendererForThisTest = createRendererUnderTest({}, localDocContextNoSpeech);
            rendererForThisTest.selectedAction = actionToSubmit;
            rendererForThisTest.sendButtonElement.disabled = false;

            mockLogger.warn.mockClear();

            await rendererForThisTest.sendButtonElement.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_EVENT,
                {actionId: actionToSubmit.id, speech: null}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} No speech input element available. Proceeding without speech text.`),
                expect.objectContaining({speechInputElement: null})
            );
        });


        it('should log error and not change UI state if dispatchValidated returns false', async () => {
            commandInputElement.value = 'Test speech';
            mockVed.dispatchValidated.mockResolvedValue(false); // Simulate dispatch failure

            // Ensure actionButtonInstance.classList.remove is clear before this operation
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                actionButtonInstance.classList.remove.mockClear();
            }

            await mockSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_EVENT}' for action ID '${actionToSubmit.id}'. dispatchValidated returned false.`),
                {payload: {actionId: actionToSubmit.id, speech: 'Test speech'}}
            );

            expect(commandInputElement.value).toBe('Test speech'); // Speech input not cleared
            expect(renderer.selectedAction).toEqual(actionToSubmit); // Action still selected
            expect(mockSendButton.disabled).toBe(false); // Send button still enabled

            // Verify 'selected' class was NOT removed
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
            }
        });

        it('should log error and not change UI state if dispatchValidated throws an error', async () => {
            commandInputElement.value = 'Test speech again';
            const dispatchError = new Error('Network Error');
            mockVed.dispatchValidated.mockRejectedValue(dispatchError); // Simulate dispatch error

            // Ensure actionButtonInstance.classList.remove is clear
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                actionButtonInstance.classList.remove.mockClear();
            }

            await mockSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_EVENT}' (Action ID: ${actionToSubmit.id}).`),
                {error: dispatchError, payload: {actionId: actionToSubmit.id, speech: 'Test speech again'}}
            );

            expect(commandInputElement.value).toBe('Test speech again'); // Speech input not cleared
            expect(renderer.selectedAction).toEqual(actionToSubmit); // Action still selected
            expect(mockSendButton.disabled).toBe(false); // Send button still enabled

            // Verify 'selected' class was NOT removed
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
            }
        });

        it('should do nothing and log warning if no action is selected when send button clicked', async () => {
            renderer.selectedAction = null;
            mockSendButton.disabled = false;

            await mockSendButton.click();

            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} 'Confirm Action' clicked, but no action is selected.`));
            expect(mockSendButton.disabled).toBe(true);
        });

        it('should log error if sendButtonElement is somehow null during #handleSendAction', async () => {
            renderer.sendButtonElement = null;
            await mockSendButton.click();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} #handleSendAction called, but sendButtonElement is null.`));
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });
    });
});