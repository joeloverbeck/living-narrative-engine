// tests/domUI/actionButtonsRenderer.dispose.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {ActionButtonsRenderer} from '../../src/domUI';
// import DocumentContext from '../../src/domUI/documentContext.js'; // Will use TestSpecificDocumentContext
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

// Test-specific DocumentContext to simplify and isolate potential issues
class TestSpecificDocumentContext {
    #doc;
    constructor(docInstance) {
        this.#doc = docInstance;
        if (!this.#doc) {
            // Use console.error directly as this is for test debugging
            console.error("TestSpecificDocumentContext: Critical - received null document instance!");
        }
    }
    query(selector) {
        if (!this.#doc) {
            // console.warn(`TestSpecificDocumentContext query: No document for selector "${selector}"`);
            return null;
        }
        // console.log(`TestSpecificDocumentContext: Querying for "${selector}"`);
        const result = this.#doc.querySelector(selector);
        // console.log(`TestSpecificDocumentContext: Found for "${selector}": ${result ? 'Element' : 'null'}`);
        return result;
    }
    create(tagName) {
        if (!this.#doc) return null;
        return this.#doc.createElement(tagName);
    }
    get document() {
        return this.#doc;
    }
}


describe('ActionButtonsRenderer', () => {
    let dom;
    let jsdDocument; // Explicitly named to avoid confusion with global document
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainerEl;
    let mockSendButtonEl;
    let commandInputElementEl;

    const CLASS_PREFIX = '[ActionButtonsRenderer]';

    // createMockElement remains the same as provided in the failing test
    const createMockElement = (sourceDoc, tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = sourceDoc.createElement(tagName);
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            classArray.forEach(cls => element.classList.add(cls));
        }
        element.textContent = textContent;
        element._attributes = {};
        element._listeners = {};
        const originalAddEventListener = element.addEventListener.bind(element);
        const originalRemoveEventListener = element.removeEventListener.bind(element);
        element.addEventListener = jest.fn((event, cb, options) => {
            originalAddEventListener(event, cb, options);
            if (!element._listeners[event]) element._listeners[event] = [];
            element._listeners[event].push({ cb, options });
        });
        element.removeEventListener = jest.fn((name, cb, options) => {
            originalRemoveEventListener(name, cb, options);
            if (element._listeners[name]) {
                element._listeners[name] = element._listeners[name].filter(listener => listener.cb !== cb);
            }
        });
        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener.cb();
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
                set: (val) => { currentValue = String(val); },
                configurable: true
            });
            if (textContent) element.value = textContent;
            element.type = 'text';
        }
        const actualClassList = element.classList;
        const originalClassListAdd = actualClassList.add.bind(actualClassList);
        const originalClassListRemove = actualClassList.remove.bind(actualClassList);
        const originalClassListContains = actualClassList.contains.bind(actualClassList);
        jest.spyOn(actualClassList, 'add').mockImplementation((...args) => { originalClassListAdd(...args); });
        jest.spyOn(actualClassList, 'remove').mockImplementation((...args) => { originalClassListRemove(...args); });
        jest.spyOn(actualClassList, 'contains').mockImplementation((...args) => { return originalClassListContains(...args); });
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
        jsdDocument = dom.window.document;

        // Set globals carefully
        global.window = dom.window;
        global.document = jsdDocument;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;

        // Use TestSpecificDocumentContext
        docContext = new TestSpecificDocumentContext(jsdDocument);

        // Enhanced logger mock
        mockLogger = new ConsoleLogger();
        const methodsToSpy = ['debug', 'info', 'warn', 'error'];
        methodsToSpy.forEach(methodName => {
            // Ensure the method exists on the (mocked) ConsoleLogger instance before trying to spy/enhance
            if (typeof mockLogger[methodName] === 'function' && jest.isMockFunction(mockLogger[methodName])) {
                const originalMockImpl = mockLogger[methodName].getMockImplementation() || jest.fn();
                mockLogger[methodName].mockImplementation((...args) => {
                    // Log to Jest console for visibility during test run
                    console.log(`[JEST_TEST_LOGGER.${methodName.toUpperCase()}]:`, ...args.map(arg =>
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                    ));
                    originalMockImpl(...args); // Call the original mock behavior (which might be nothing or specific test mock)
                });
            } else {
                // Fallback if methods are not jest.fn() from the module mock (e.g. if it's not a full auto-mock)
                mockLogger[methodName] = jest.fn((...args) => {
                    console.log(`[JEST_TEST_LOGGER.${methodName.toUpperCase()} STUBBED]:`, ...args.map(arg =>
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                    ));
                });
            }
        });


        mockVed = new ValidatedEventDispatcher({ logger: mockLogger });
        mockDomElementFactoryInstance = new DomElementFactory(docContext);

        if (!jest.isMockFunction(mockDomElementFactoryInstance.button)) {
            mockDomElementFactoryInstance.button = jest.fn().mockImplementation((text, cls) => {
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement(jsdDocument, 'button', '', classes, text);
            });
        }
        if (!jest.isMockFunction(mockDomElementFactoryInstance.create)) {
            mockDomElementFactoryInstance.create = jest.fn().mockImplementation((tagName, options) => {
                const el = jsdDocument.createElement(tagName);
                if(options?.id) el.id = options.id;
                if(options?.cls) {
                    const classes = Array.isArray(options.cls) ? options.cls : options.cls.split(' ');
                    classes.forEach(c => el.classList.add(c));
                }
                if(options?.text) el.textContent = options.text;
                if(options?.attrs) {
                    for(const [key,value] of Object.entries(options.attrs)) {
                        el.setAttribute(key, String(value)); // Ensure value is string
                    }
                }
                return el;
            });
        }

        actionButtonsContainerEl = jsdDocument.getElementById('action-buttons');
        mockSendButtonEl = jsdDocument.getElementById('player-confirm-turn-button');
        commandInputElementEl = jsdDocument.getElementById('speech-input');

        if (actionButtonsContainerEl) {
            jest.spyOn(actionButtonsContainerEl, 'appendChild');
            jest.spyOn(actionButtonsContainerEl, 'removeChild');
        }
        if (mockSendButtonEl && !jest.isMockFunction(mockSendButtonEl.removeEventListener)) {
            // Spy only if not already a Jest spy from createMockElement or manual spy
            jest.spyOn(mockSendButtonEl, 'removeEventListener');
        }

        mockVed.subscribe = jest.fn().mockReturnValue(jest.fn());
        mockVed.dispatchValidated = jest.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (dom && dom.window && dom.window.close) {
            dom.window.close();
        }
        dom = null;
        jsdDocument = null; // Clear the explicit jsdDocument reference
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.HTMLButtonElement;
        delete global.HTMLInputElement;
    });

    const createRenderer = ({
                                actionButtonsContainerSelector = '#action-buttons',
                                sendButtonSelector = '#player-confirm-turn-button',
                                speechInputSelector = '#speech-input'
                            } = {}) => {
        // console.log(`[Test createRenderer] Using docContext of type: ${docContext?.constructor?.name}`);
        // const checkElement = docContext.query(actionButtonsContainerSelector);
        // console.log(`[Test createRenderer] Check query for "${actionButtonsContainerSelector}" before new ActionButtonsRenderer: ${checkElement ? 'FOUND' : 'NOT FOUND'}`);

        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext, // Uses TestSpecificDocumentContext now
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactoryInstance,
            actionButtonsContainerSelector: actionButtonsContainerSelector,
            sendButtonSelector: sendButtonSelector,
            speechInputSelector: speechInputSelector,
        });
    };

    describe('dispose()', () => {
        let rendererForDispose;
        let mockUnsubscribeFunction;

        beforeEach(() => {
            mockUnsubscribeFunction = jest.fn();
            mockVed.subscribe.mockReturnValue(mockUnsubscribeFunction);

            // Clear logger mocks more thoroughly if they are jest.fn()
            if (jest.isMockFunction(mockLogger.debug)) mockLogger.debug.mockClear();
            if (jest.isMockFunction(mockLogger.info)) mockLogger.info.mockClear();
            if (jest.isMockFunction(mockLogger.warn)) mockLogger.warn.mockClear();
            if (jest.isMockFunction(mockLogger.error)) mockLogger.error.mockClear();

            rendererForDispose = createRenderer(); // This will now use TestSpecificDocumentContext

            // Spy on removeEventListener of the actual bound element
            if (rendererForDispose.elements.sendButtonElement &&
                !jest.isMockFunction(rendererForDispose.elements.sendButtonElement.removeEventListener)) {
                jest.spyOn(rendererForDispose.elements.sendButtonElement, 'removeEventListener');
            }
        });

        it('should unsubscribe from VED event and remove send button listener', () => {
            const boundSendButton = rendererForDispose.elements.sendButtonElement;
            // This assertion might still fail if element binding itself fails due to the listContainerElement issue
            // However, if TestSpecificDocumentContext fixes the listContainerElement lookup, this should proceed.
            expect(boundSendButton).toBeDefined();
            expect(boundSendButton).not.toBeNull();


            rendererForDispose.dispose();

            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Unsubscribing 1 VED event subscriptions.`));

            // Check removeEventListener on the actual element obtained by the renderer
            expect(boundSendButton.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function), undefined);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringMatching(/Removing 1 DOM event listeners./) // Regex to be flexible with exact count if other listeners exist
            );
        });

        // Other tests (should call base class dispose, should handle multiple dispose calls, should clear container)
        // remain the same as they were passing or their logic was addressed by changes to ActionButtonsRenderer.js
        it('should call base class dispose (logs message from base and specific dispose)', () => {
            const basePrototype = Object.getPrototypeOf(ActionButtonsRenderer.prototype);
            const grandBasePrototype = Object.getPrototypeOf(basePrototype);
            const greatGrandBasePrototype = Object.getPrototypeOf(grandBasePrototype);

            const baseDisposeSpy = jest.spyOn(greatGrandBasePrototype, 'dispose');

            rendererForDispose.dispose();

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing ActionButtonsRenderer.`));
            expect(baseDisposeSpy).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Starting disposal: Unsubscribing VED events and removing DOM listeners.`));

            baseDisposeSpy.mockRestore();
        });

        it('should handle multiple dispose calls gracefully', () => {
            const boundSendButton = rendererForDispose.elements.sendButtonElement;

            rendererForDispose.dispose();
            rendererForDispose.dispose();

            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
            if (boundSendButton && boundSendButton.removeEventListener) { // Ensure it exists and has the method
                expect(boundSendButton.removeEventListener).toHaveBeenCalledTimes(1);
            }

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            const disposeLogCalls = mockLogger.info.mock.calls.filter(call => call[0].includes(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`));
            expect(disposeLogCalls.length).toBe(1);
        });

        it('should clear action buttons container and reset internal state', () => {
            if (!actionButtonsContainerEl) throw new Error("actionButtonsContainerEl is null in test");

            const dummyButton = jsdDocument.createElement('button');
            actionButtonsContainerEl.appendChild(dummyButton);
            expect(actionButtonsContainerEl.children.length).toBe(1);

            rendererForDispose.availableActions = [{id: 'test:test', name: 'Test Action', command: 'test', description: 'A test action'}];
            rendererForDispose.selectedAction = rendererForDispose.availableActions[0];
            rendererForDispose._setTestCurrentActorId('actor123');

            rendererForDispose.dispose();

            expect(actionButtonsContainerEl.children.length).toBe(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Cleared listContainerElement content during dispose.`));

            expect(rendererForDispose.availableActions.length).toBe(0);
            expect(rendererForDispose.selectedAction).toBeNull();
            expect(rendererForDispose._getTestCurrentActorId()).toBeNull();
        });
    });
});