// src/tests/domUI/actionButtonsRenderer.dispose.test.js

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
// Mock the factory module itself for constructor tests
jest.mock('../../src/domUI/domElementFactory.js');


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
                <input type="text" id="speech-input" />
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
        mockVed = new ValidatedEventDispatcher({}); // VED mock instance

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

        actionButtonsContainer = document.getElementById('action-buttons');

        const sendButtonElemOriginal = document.getElementById('player-confirm-turn-button');
        mockSendButton = createMockElement(document, 'button', 'player-confirm-turn-button');
        if (sendButtonElemOriginal && sendButtonElemOriginal.parentNode) {
            sendButtonElemOriginal.parentNode.replaceChild(mockSendButton, sendButtonElemOriginal);
        } else {
            document.body.appendChild(mockSendButton);
        }


        const commandInputElemOriginal = document.getElementById('speech-input');
        commandInputElement = createMockElement(document, 'input', 'speech-input');
        if (commandInputElemOriginal && commandInputElemOriginal.parentNode) {
            commandInputElemOriginal.parentNode.replaceChild(commandInputElement, commandInputElemOriginal);
        } else {
            document.body.appendChild(commandInputElement);
        }

        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        // MODIFIED: mockVed.subscribe should return a jest.fn() directly (the UnsubscribeFn)
        // This is a default mock; specific tests (like dispose) will override this if needed.
        mockVed.subscribe.mockReturnValue(jest.fn());
        mockVed.dispatchValidated.mockResolvedValue(true);


        if (actionButtonsContainer) {
            jest.spyOn(actionButtonsContainer, 'appendChild');
            jest.spyOn(actionButtonsContainer, 'removeChild');
        }
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore all mocks

        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.HTMLButtonElement;
        delete global.HTMLInputElement;
        if (dom && dom.window && dom.window.document && dom.window.document.body) {
            dom.window.document.body.innerHTML = ''; // Clear body
        }
        dom = null;
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
        // MODIFIED: This will now be the mock unsubscribe function itself
        let mockUnsubscribeFunction;

        beforeEach(() => {
            // MODIFIED: mockVed.subscribe returns a jest.fn() which is our unsubscribe function
            mockUnsubscribeFunction = jest.fn();
            mockVed.subscribe.mockReturnValue(mockUnsubscribeFunction);

            rendererForDispose = createRenderer();
            // Clear mocks for logger for each test in this describe block
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
        });

        it('should unsubscribe from VED event and remove send button listener', () => {
            const removeListenerFn = rendererForDispose.sendButtonElement.removeEventListener;

            rendererForDispose.dispose();

            // MODIFIED: Expect the mock unsubscribe function itself to be called
            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));

            expect(removeListenerFn).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Removed click listener from 'Confirm Action' button.`));
        });

        it('should call base class dispose (logs message)', () => {
            const basePrototype = Object.getPrototypeOf(ActionButtonsRenderer.prototype);
            const baseDisposeSpy = jest.spyOn(basePrototype, 'dispose');

            rendererForDispose.dispose();

            // This expectation depends on RendererBase.dispose() logging '[ClassName] Disposing.'
            // If RendererBase has a different prefix or log message, this might need adjustment.
            // Assuming RendererBase also uses this._logPrefix format:
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing.`));
            expect(baseDisposeSpy).toHaveBeenCalled();

            baseDisposeSpy.mockRestore();
        });

        it('should handle multiple dispose calls gracefully', () => {
            const removeListenerFn = rendererForDispose.sendButtonElement.removeEventListener;

            rendererForDispose.dispose();
            rendererForDispose.dispose(); // Second call

            // MODIFIED: Expect the mock unsubscribe function itself to be called only once
            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
            expect(removeListenerFn).toHaveBeenCalledTimes(1);

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            // Ensure the "disposed" info log is only called once
            const disposeLogCalls = mockLogger.info.mock.calls.filter(call => call[0].includes(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            expect(disposeLogCalls.length).toBe(1);
        });

        it('should clear action buttons container and reset internal state', () => {
            if (!actionButtonsContainer) throw new Error("actionButtonsContainer is null in test body for 'should clear action buttons container'");

            const dummyButton = document.createElement('button');
            actionButtonsContainer.appendChild(dummyButton);
            rendererForDispose.availableActions = [{id: 'test:test', command: 'test'}];

            rendererForDispose.dispose();

            expect(actionButtonsContainer.children.length).toBe(0);
            expect(rendererForDispose.availableActions.length).toBe(0);
            expect(rendererForDispose.selectedAction).toBeNull();
        });
    });
});