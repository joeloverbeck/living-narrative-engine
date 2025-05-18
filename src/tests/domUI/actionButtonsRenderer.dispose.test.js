// src/tests/domUI/actionButtonsRenderer.dispose.test.js

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
// Mock the factory module itself for constructor tests
jest.mock('../../domUI/domElementFactory');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document; // JSDOM document instance
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainer;
    let mockSendButton;
    let commandInputElement;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const PLAYER_TURN_SUBMITTED_EVENT = 'core:player_turn_submitted';

    // --- Mock Elements ---
    const createMockElement = (sourceDoc, tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = sourceDoc.createElement(tagName); // Use provided document
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            classArray.forEach(cls => element.classList.add(cls));
        }
        element.textContent = textContent;

        element._attributes = {};
        element._listeners = {};

        element.addEventListener = jest.fn((event, cb, options) => {
            if (!element._listeners[event]) element._listeners[event] = [];
            element._listeners[event].push(cb);
        });

        element.removeEventListener = jest.fn((name, cb, options) => {
            if (element._listeners[name]) {
                element._listeners[name] = element._listeners[name].filter(fn => fn !== cb);
            }
        });

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

        const originalGetAttribute = element.getAttribute.bind(element);
        jest.spyOn(element, 'getAttribute').mockImplementation((name) => {
            return originalGetAttribute(name);
        });

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
            let currentValue = '';
            Object.defineProperty(element, 'value', {
                get: () => currentValue,
                set: (val) => {
                    currentValue = String(val);
                },
                configurable: true
            });
            if (textContent) element.value = textContent;
            element.type = 'text'; // Ensure type is set for inputs
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
        document = dom.window.document; // Capture the JSDOM document
        global.document = document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;

        docContext = new DocumentContext(document);

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});

        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        if (!jest.isMockFunction(mockDomElementFactoryInstance.button)) {
            mockDomElementFactoryInstance.button = jest.fn().mockImplementation((text, cls) => {
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement(document, 'button', '', classes, text);
            });
        }
        if (!jest.isMockFunction(mockDomElementFactoryInstance.create)) {
            mockDomElementFactoryInstance.create = jest.fn().mockImplementation(tagName => document.createElement(tagName));
        }

        // Directly use document.getElementById for robust fetching in test setup
        actionButtonsContainer = document.getElementById('action-buttons');

        const sendButtonElemOriginal = document.getElementById('player-confirm-turn-button');
        mockSendButton = createMockElement(document, 'button', 'player-confirm-turn-button');
        if (sendButtonElemOriginal && sendButtonElemOriginal.parentNode) {
            sendButtonElemOriginal.parentNode.replaceChild(mockSendButton, sendButtonElemOriginal);
        } else {
            // This fallback should ideally not be hit if JSDOM structure is as defined
            console.warn("Original send button not found or parent missing, appending to body.");
            document.body.appendChild(mockSendButton);
        }


        const commandInputElemOriginal = document.getElementById('command-input');
        commandInputElement = createMockElement(document, 'input', 'command-input');
        // commandInputElement.type = 'text'; // Already set in createMockElement for input
        if (commandInputElemOriginal && commandInputElemOriginal.parentNode) {
            commandInputElemOriginal.parentNode.replaceChild(commandInputElement, commandInputElemOriginal);
        } else {
            console.warn("Original command input not found or parent missing, appending to body.");
            document.body.appendChild(commandInputElement);
        }

        if (!actionButtonsContainer) {
            // This error indicates a fundamental problem with JSDOM setup or element ID.
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM. Check JSDOM structure and element ID.");
        }

        mockVed.subscribe.mockReturnValue({unsubscribe: jest.fn()});
        mockVed.dispatchValidated.mockResolvedValue(true);


        if (actionButtonsContainer) {
            jest.spyOn(actionButtonsContainer, 'appendChild');
            jest.spyOn(actionButtonsContainer, 'removeChild');
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();

        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.HTMLButtonElement;
        delete global.HTMLInputElement;
        if (dom && dom.window && dom.window.document && dom.window.document.body) {
            dom.window.document.body.innerHTML = '';
        }
        dom = null; // Aid GC
        document = null;
    });

    const createRenderer = (
        containerOverride = actionButtonsContainer,
        factoryOverride = mockDomElementFactoryInstance,
        sendButtonOverride = mockSendButton
    ) => {
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride,
        });
    };

    describe('dispose()', () => {
        let rendererForDispose;
        let mockSubscriptionForDispose;

        beforeEach(() => {
            mockSubscriptionForDispose = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscriptionForDispose);

            rendererForDispose = createRenderer();
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
        });

        it('should unsubscribe from VED event and remove send button listener', () => {
            const removeListenerFn = rendererForDispose.sendButtonElement.removeEventListener;

            rendererForDispose.dispose();

            expect(mockSubscriptionForDispose.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));

            expect(removeListenerFn).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Removed click listener from 'Confirm Action' button.`));
        });

        it('should call base class dispose (logs message)', () => {
            const basePrototype = Object.getPrototypeOf(ActionButtonsRenderer.prototype);
            const baseDisposeSpy = jest.spyOn(basePrototype, 'dispose');

            rendererForDispose.dispose();

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing.`));
            expect(baseDisposeSpy).toHaveBeenCalled();

            baseDisposeSpy.mockRestore();
        });

        it('should handle multiple dispose calls gracefully', () => {
            const removeListenerFn = rendererForDispose.sendButtonElement.removeEventListener;

            rendererForDispose.dispose();
            rendererForDispose.dispose();

            expect(mockSubscriptionForDispose.unsubscribe).toHaveBeenCalledTimes(1);
            expect(removeListenerFn).toHaveBeenCalledTimes(1);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            const disposeLogCalls = mockLogger.info.mock.calls.filter(call => call[0].includes(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            expect(disposeLogCalls.length).toBe(1); // This should now pass with the guard in ActionButtonsRenderer.dispose()
        });

        it('should clear action buttons container and reset internal state', () => {
            if (!actionButtonsContainer) throw new Error("actionButtonsContainer is null in test body for 'should clear action buttons container'");

            const dummyButton = document.createElement('button'); // Use the global document from beforeEach
            actionButtonsContainer.appendChild(dummyButton);
            rendererForDispose.availableActions = [{id: 'test:test', command: 'test'}];

            rendererForDispose.dispose();

            expect(actionButtonsContainer.children.length).toBe(0);
            expect(rendererForDispose.availableActions.length).toBe(0);
            expect(rendererForDispose.selectedAction).toBeNull();
        });
    });
});