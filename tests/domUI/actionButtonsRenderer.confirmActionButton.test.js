// tests/domUI/actionButtonsRenderer.confirmActionButton.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {ActionButtonsRenderer} from '../../src/domUI/index.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import {PLAYER_TURN_SUBMITTED_ID} from "../../src/constants/eventIds.js";

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer', () => {
    let dom;
    let currentDocument;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainer;
    let globalMockSendButton;
    let commandInputElement;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const MOCK_ACTOR_ID = 'test-actor-id'; // Define a consistent mock actor ID

    const createTestAction = (id, name, command, description) => ({
        id,
        name,
        command,
        description,
    });

    const createMockElement = (sourceDoc, tagName = 'div', id = '', classesParam = [], textContent = '') => {
        const element = sourceDoc.createElement(tagName);
        if (id) element.id = id;
        element.textContent = textContent;

        if (element.classList) {
            jest.spyOn(element.classList, 'add');
            jest.spyOn(element.classList, 'remove');
            jest.spyOn(element.classList, 'contains');
            jest.spyOn(element.classList, 'toggle');
        } else {
            element.classList = {
                add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn(), length: 0, toString: () => ""
            };
        }

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
            if (name === 'data-action-id' && name in element._attributes) return element._attributes[name];
            if (name in element._attributes && !(name === 'class' || name === 'style')) return element._attributes[name];
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
                <input type="text" id="speech-input" />
            </div>
        </body></html>`);
        currentDocument = dom.window.document;
        global.document = currentDocument;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;
        jest.clearAllMocks();
        docContext = new DocumentContext(currentDocument);
        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});
        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        mockVed.subscribe.mockReturnValue({unsubscribe: jest.fn()});
        mockVed.dispatchValidated.mockResolvedValue(true);
        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
            const classesArray = Array.isArray(cls) ? cls : (cls ? cls.split(' ').filter(c => c) : []);
            return createMockElement(currentDocument, 'button', '', classesArray, text);
        });
        mockDomElementFactoryInstance.create.mockImplementation(tagName => currentDocument.createElement(tagName));
        actionButtonsContainer = currentDocument.getElementById('action-buttons');
        if (!actionButtonsContainer) {
            throw new Error("Critical Test Setup Failed: #action-buttons container not found in JSDOM.");
        }
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
        const sendButtonOriginal = currentDocument.getElementById('player-confirm-turn-button');
        globalMockSendButton = createMockElement(currentDocument, 'button', 'player-confirm-turn-button');
        if (sendButtonOriginal && sendButtonOriginal.parentNode) {
            sendButtonOriginal.parentNode.replaceChild(globalMockSendButton, sendButtonOriginal);
        } else {
            currentDocument.body.appendChild(globalMockSendButton);
        }
        const commandInputOriginal = currentDocument.getElementById('speech-input');
        commandInputElement = createMockElement(currentDocument, 'input', 'speech-input', [], '');
        commandInputElement.type = 'text';
        if (commandInputOriginal && commandInputOriginal.parentNode) {
            commandInputOriginal.parentNode.replaceChild(commandInputElement, commandInputOriginal);
        } else {
            currentDocument.body.appendChild(commandInputElement);
        }
    });

    afterEach(() => {
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
            sendButtonElement: globalMockSendButton,
        };
        return new ActionButtonsRenderer({...defaults, ...rendererConfig});
    };

    describe('Confirm Action Button (#handleSendAction)', () => {
        const actionToSubmit = createTestAction(
            'core:submit_me',
            'Submit Action',
            'Submit This',
            'This action will be submitted for testing.'
        );
        const actions = [actionToSubmit];
        let rendererForDescribeBlock;
        let actionButtonInstance;
        let specificTestDocContext;

        beforeEach(async () => {
            actionButtonInstance = undefined;
            specificTestDocContext = {
                ...docContext,
                query: jest.fn(selector => {
                    if (selector === '#speech-input') return commandInputElement;
                    return currentDocument.querySelector(selector);
                }),
                getElementById: jest.fn(id => currentDocument.getElementById(id)),
                create: jest.fn(tagName => currentDocument.createElement(tagName)),
            };

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

            rendererForDescribeBlock = createRendererUnderTest({}, specificTestDocContext);
            // Use the test-specific setter for #currentActorId
            rendererForDescribeBlock._setTestCurrentActorId(MOCK_ACTOR_ID);
            rendererForDescribeBlock.render(actions);


            if (!actionButtonInstance) {
                throw new Error(`Test setup error: actionButtonInstance for command '${actionToSubmit.command}' was not created. Ensure the action passes validation in #handleUpdateActions.`);
            }

            ['info', 'error', 'debug', 'warn'].forEach(level => mockLogger[level].mockClear());
            mockVed.dispatchValidated.mockClear();
            if (actionButtonInstance && actionButtonInstance.classList) {
                actionButtonInstance.classList.add.mockClear();
                actionButtonInstance.classList.remove.mockClear();
            }

            await actionButtonInstance.click();

            expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
            expect(globalMockSendButton.disabled).toBe(false);
            expect(actionButtonInstance.classList.add).toHaveBeenCalledWith('selected');

            ['info', 'error', 'debug', 'warn'].forEach(level => mockLogger[level].mockClear());
            mockVed.dispatchValidated.mockClear();
            if (actionButtonInstance && actionButtonInstance.classList) {
                actionButtonInstance.classList.add.mockClear();
                actionButtonInstance.classList.remove.mockClear();
            }
        });

        it('should dispatch event with actionId and speech, clear speech, deselect, and disable send button on successful dispatch', async () => {
            commandInputElement.value = 'Player says this';
            mockVed.dispatchValidated.mockResolvedValue(true);

            await globalMockSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_ID,
                {submittedByActorId: MOCK_ACTOR_ID, actionId: actionToSubmit.id, speech: 'Player says this'}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched successfully for action ID '${actionToSubmit.id}' by actor '${MOCK_ACTOR_ID}'.`));
            expect(commandInputElement.value).toBe('');
            expect(rendererForDescribeBlock.selectedAction).toBeNull();
            expect(globalMockSendButton.disabled).toBe(true);

            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).toHaveBeenCalledWith('selected');
            } else {
                throw new Error("actionButtonInstance or its classList.remove spy is not defined for assertion.");
            }
        });

        it('should dispatch event with speech: null if speech input is empty', async () => {
            commandInputElement.value = '';
            mockVed.dispatchValidated.mockResolvedValue(true);
            await globalMockSendButton.click();
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_ID,
                {submittedByActorId: MOCK_ACTOR_ID, actionId: actionToSubmit.id, speech: null}
            );
            expect(commandInputElement.value).toBe('');
        });

        it('should dispatch event with speech: null and log warning if speech input element is missing post-construction', async () => {
            const localDocContextNoSpeech = {
                ...specificTestDocContext,
                query: (selector) => {
                    if (selector === '#speech-input') return null;
                    return currentDocument.querySelector(selector);
                },
            };

            const testSpecificSendButton = createMockElement(currentDocument, 'button', 'test-send-button');
            const rendererForThisTest = createRendererUnderTest({
                sendButtonElement: testSpecificSendButton
            }, localDocContextNoSpeech);

            // Use the test-specific setter for #currentActorId for this specific renderer instance
            rendererForThisTest._setTestCurrentActorId(MOCK_ACTOR_ID);

            rendererForThisTest.selectedAction = actionToSubmit;
            testSpecificSendButton.disabled = false;

            mockLogger.warn.mockClear();
            mockVed.dispatchValidated.mockClear().mockResolvedValue(true);

            await testSpecificSendButton.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
                PLAYER_TURN_SUBMITTED_ID,
                {submittedByActorId: MOCK_ACTOR_ID, actionId: actionToSubmit.id, speech: null}
            );
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining("Could not find/deselect the selected action button"),
                expect.anything()
            );
        });


        it('should log error and not change UI state if dispatchValidated returns false', async () => {
            commandInputElement.value = 'Test speech';
            mockVed.dispatchValidated.mockResolvedValue(false);
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                actionButtonInstance.classList.remove.mockClear();
            }
            await globalMockSendButton.click();
            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action ID '${actionToSubmit.id}'. dispatchValidated returned false.`),
                {payload: {submittedByActorId: MOCK_ACTOR_ID, actionId: actionToSubmit.id, speech: 'Test speech'}}
            );
            expect(commandInputElement.value).toBe('Test speech');
            expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
            expect(globalMockSendButton.disabled).toBe(false);
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
            }
        });

        it('should log error and not change UI state if dispatchValidated throws an error', async () => {
            commandInputElement.value = 'Test speech again';
            const dispatchError = new Error('Network Error');
            mockVed.dispatchValidated.mockRejectedValue(dispatchError);
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                actionButtonInstance.classList.remove.mockClear();
            }
            await globalMockSendButton.click();
            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_ID}' (Action ID: ${actionToSubmit.id}).`),
                {
                    error: dispatchError,
                    payload: {
                        submittedByActorId: MOCK_ACTOR_ID,
                        actionId: actionToSubmit.id,
                        speech: 'Test speech again'
                    }
                }
            );
            expect(commandInputElement.value).toBe('Test speech again');
            expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
            expect(globalMockSendButton.disabled).toBe(false);
            if (actionButtonInstance && actionButtonInstance.classList && actionButtonInstance.classList.remove) {
                expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
            }
        });

        it('should do nothing and log warning if no action is selected when send button clicked', async () => {
            rendererForDescribeBlock.selectedAction = null;
            // Note: rendererForDescribeBlock._getTestCurrentActorId() would still be MOCK_ACTOR_ID from beforeEach
            globalMockSendButton.disabled = false;
            await globalMockSendButton.click();
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} 'Confirm Action' clicked, but no action is selected.`));
            expect(globalMockSendButton.disabled).toBe(true);
        });

        it('should log error if sendButtonElement is somehow null during #handleSendAction', async () => {
            // Note: rendererForDescribeBlock._getTestCurrentActorId() would still be MOCK_ACTOR_ID
            expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
            rendererForDescribeBlock.sendButtonElement = null;

            await globalMockSendButton.click();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} #handleSendAction called, but sendButtonElement is null.`));
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });
    });
});