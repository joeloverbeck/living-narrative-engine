// src/tests/domUI/uiMessageRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {UiMessageRenderer} from '../../src/domUI/index.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
// jest.mock('../../domUI/domElementFactory'); // We will mock methods individually

describe('UiMessageRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance; // Instance of the real factory, but we'll spy on its methods
    let outputDiv; // Define outputDiv
    let messageList;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="outputDiv"><ul id="message-list"></ul></div></body></html>`);
        document = dom.window.document;
        docContext = new DocumentContext(document.body); // Use document.body to ensure it can find #outputDiv

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger);
        mockDomElementFactoryInstance = new DomElementFactory(docContext); // Real factory for spying

        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        // Spy on factory methods that will be used by the renderer
        jest.spyOn(mockDomElementFactoryInstance, 'li').mockImplementation((cls, text) => {
            const liEl = document.createElement('li');
            const addClasses = (element, classes) => {
                if (!classes) return;
                if (Array.isArray(classes)) {
                    element.classList.add(...classes.filter(c => c));
                } else if (typeof classes === 'string') {
                    const clsArr = classes.split(' ').filter(c => c);
                    if (clsArr.length > 0) element.classList.add(...clsArr);
                }
            };
            addClasses(liEl, cls);
            if (text !== undefined) liEl.textContent = text;
            return liEl;
        });

        // Spy on 'create' specifically for 'ul' creation if needed, or general 'create'
        jest.spyOn(mockDomElementFactoryInstance, 'create').mockImplementation((tagName, options) => {
            if (tagName === 'ul' && options && options.id === 'message-list') {
                const ulEl = document.createElement('ul');
                ulEl.id = options.id;
                if (options.attrs) {
                    for (const [key, value] of Object.entries(options.attrs)) {
                        ulEl.setAttribute(key, value);
                    }
                }
                return ulEl;
            }
            // Fallback to a simple createElement for other potential 'create' calls if any
            return document.createElement(tagName);
        });


        outputDiv = document.getElementById('outputDiv');
        messageList = document.getElementById('message-list');

        // General mock for docContext.query, can be overridden in specific tests if needed
        const originalQuery = docContext.query.bind(docContext); // Bind to keep 'this' context if original is complex
        jest.spyOn(docContext, 'query').mockImplementation((selector) => {
            if (selector === '#message-list') {
                return document.getElementById('message-list');
            }
            if (selector === '#outputDiv') {
                return document.getElementById('outputDiv');
            }
            // Fallback to JSDOM's actual querySelector for any other selectors.
            // This might be document.querySelector(selector) if docContext wraps 'document'
            // or use the original method if docContext.query has more logic.
            // For this test setup, document.querySelector is likely sufficient.
            return dom.window.document.querySelector(selector);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Use restoreAllMocks to clean up spies on real instances
        if (document && document.body) {
            document.body.innerHTML = '';
        }
    });

    const createRenderer = (factoryInstance = mockDomElementFactoryInstance) => {
        return new UiMessageRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryInstance
        });
    };

    describe('Rendering Messages', () => {
        it('should render info message', () => {
            const renderer = createRenderer();
            const text = 'Info message test';
            renderer.render(text, 'info');

            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message')).toBe(true);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });

        it('should render fatal error message', () => {
            const renderer = createRenderer();
            const text = 'Fatal error test';
            renderer["_UiMessageRenderer__onShowFatal"]({
                type: 'core:system_error_occurred',
                payload: {message: text}
            });
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Fatal error displayed: ${text}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: fatal - ${text.substring(0, 50)}`));
        });

        it('should render fatal error message with Error details', () => {
            const renderer = createRenderer();
            const baseText = 'Fatal error occurred.';
            const errorDetails = 'Detailed reason.';
            const fullText = `${baseText}\nDetails: ${errorDetails}`;
            renderer["_UiMessageRenderer__onShowFatal"]({
                type: 'core:system_error_occurred',
                payload: {message: baseText, error: new Error(errorDetails)}
            });
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(fullText);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Fatal error displayed: ${fullText}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: fatal - ${fullText.substring(0, 50)}`));
        });

        it('should render command echo message', () => {
            const renderer = createRenderer();
            const command = 'look around';
            const text = `> ${command}`;
            renderer["_UiMessageRenderer__onCommandEcho"]({
                type: 'core:action_executed',
                payload: {originalInput: command}
            });
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - ${text.substring(0, 50)}`));
        });

        it('should render info message with HTML when allowHtml is true', () => {
            const renderer = createRenderer();
            const text = 'Info <b>bold</b> test';
            renderer.render(text, 'info', true);
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Info bold test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });

        it('should render info message without HTML when allowHtml is false (default)', () => {
            const renderer = createRenderer();
            const text = 'Info <b>bold</b> test';
            renderer.render(text, 'info', false);
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.innerHTML).toBe('Info &lt;b&gt;bold&lt;/b&gt; test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });
    });

    describe('Event Handling (VED Subscriptions)', () => {
        it('should subscribe to events on construction', () => {
            createRenderer();
            expect(mockVed.subscribe).toHaveBeenCalledTimes(4);
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:display_message', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:action_executed', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:action_failed', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Subscribed to VED events.'));
        });

        it('should handle textUI:display_message event', () => {
            const renderer = createRenderer();
            const payload = {message: 'VED Message', type: 'info', allowHtml: false};
            const displayMessageHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'textUI:display_message')[1];
            displayMessageHandler({type: 'textUI:display_message', payload: payload});
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(payload.message);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${payload.message.substring(0, 50)}`));
        });

        it('should handle core:system_error_occurred event', () => {
            const renderer = createRenderer();
            const payload = {message: 'VED Fatal Error'};
            const fatalHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:system_error_occurred')[1];
            fatalHandler({type: 'core:system_error_occurred', payload: payload});
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(payload.message);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Fatal error displayed: ${payload.message}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: fatal - ${payload.message.substring(0, 50)}`));
        });

        it('should handle core:action_executed event (echo)', () => {
            const renderer = createRenderer();
            const command = 'do something';
            const payload = {originalInput: command};
            const echoHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_executed')[1];
            echoHandler({type: 'core:action_executed', payload: payload});
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(`> ${command}`);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - > ${command.substring(0, 50)}`));
        });

        it('should handle core:action_failed event (echo)', () => {
            const renderer = createRenderer();
            const command = 'try something else';
            const payload = {originalInput: command};
            const echoFailedHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_failed')[1];
            echoFailedHandler({type: 'core:action_failed', payload: payload});
            const messageElement = messageList.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(`> ${command}`);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - > ${command.substring(0, 50)}`));
        });

        it('should ignore echo events without valid originalInput', () => {
            const renderer = createRenderer();
            const echoHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_executed')[1];
            echoHandler({type: 'core:action_executed', payload: {originalInput: null}});
            echoHandler({type: 'core:action_executed', payload: {originalInput: ''}});
            echoHandler({type: 'core:action_executed', payload: {}});
            const messageElements = messageList.querySelectorAll('li');
            expect(messageElements.length).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledTimes(3);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Received command echo event without valid originalInput or command.'),
                expect.objectContaining({type: 'core:action_executed', payload: expect.anything()})
            );
        });

        it('should handle invalid display_message payload', () => {
            const renderer = createRenderer();
            const displayMessageHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'textUI:display_message')[1];
            displayMessageHandler(null);
            displayMessageHandler({});
            displayMessageHandler({type: 'textUI:display_message', payload: {message: 123}});
            const messageElements = messageList.querySelectorAll('li');
            expect(messageElements.length).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledTimes(3);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Received invalid or malformed 'textUI:display_message' event object."),
                expect.anything()
            );
        });

        it('should handle invalid system_error_occurred payload', () => {
            const renderer = createRenderer();
            const fatalHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:system_error_occurred')[1];
            fatalHandler(null);
            fatalHandler({});
            fatalHandler({type: 'core:system_error_occurred', payload: {message: 123}});
            const messageElements = messageList.querySelectorAll('li.message-fatal');
            expect(messageElements.length).toBe(3);
            messageElements.forEach(messageElement => {
                expect(messageElement.textContent).toBe('An unspecified fatal system error occurred.');
            });
            expect(mockLogger.error).toHaveBeenCalledTimes(3);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Received invalid 'core:system_error_occurred' payload."),
                expect.anything()
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rendered message: fatal - An unspecified fatal system error occurred."));
        });

        it('should unsubscribe from events on dispose', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReset();
            mockVed.subscribe.mockReturnValue(mockSubscription);

            const renderer = createRenderer();
            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(4);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
        });
    });

    describe('Error Handling & Edge Cases', () => {
        it('should log info if message list cannot be found initially and then create it', () => {
            document.getElementById('message-list').remove();
            // docContext.query will be re-spied on in createRenderer if not careful,
            // but the default beforeEach mock should handle returning current DOM state.
            // Let's ensure the spy is fresh for this test's specific needs if it differs.
            const currentQueryMock = jest.spyOn(docContext, 'query').mockImplementation((selector) => {
                if (selector === '#message-list') return document.getElementById('message-list');
                if (selector === '#outputDiv') return document.getElementById('outputDiv');
                return dom.window.document.querySelector(selector);
            });


            createRenderer();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('#message-list element not found. Attempting to create it.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('#message-list created dynamically inside #outputDiv with aria-live.'));
            expect(mockDomElementFactoryInstance.create).toHaveBeenCalledWith('ul', {
                id: 'message-list',
                attrs: {'aria-live': 'polite'}
            });
            expect(document.getElementById('message-list')).not.toBeNull();
            expect(document.getElementById('message-list').tagName).toBe('UL');
            currentQueryMock.mockRestore(); // Restore general mock
        });

        it('should log errors if #outputDiv and #message-list are missing during list creation', () => {
            document.getElementById('message-list')?.remove();
            document.getElementById('outputDiv')?.remove();

            const currentQueryMock = jest.spyOn(docContext, 'query').mockImplementation((selector) => {
                if (selector === '#message-list' || selector === '#outputDiv') return null;
                return dom.window.document.querySelector(selector);
            });

            createRenderer();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Could not find #outputDiv element! Automatic scrolling of chat panel may not work.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('#message-list element not found. Attempting to create it.'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot create #message-list: #outputDiv container not found. Messages may not display correctly and scrolling will fail.'));
            // The "Critical" log is NOT expected here due to early return.

            const finalList = document.getElementById('message-list');
            expect(finalList).toBeNull();
            currentQueryMock.mockRestore();
        });

        it('should log error and not render if message list is invalid after ensure', () => {
            const renderer = createRenderer();
            expect(renderer["_UiMessageRenderer__messageList"]).not.toBeNull();

            const currentQueryMock = jest.spyOn(docContext, 'query').mockImplementation(selector => (selector === '#message-list' ? null : document.getElementById('outputDiv')));
            const currentCreateMock = jest.spyOn(mockDomElementFactoryInstance, 'create').mockReturnValue(null);

            renderer["_UiMessageRenderer__messageList"] = null;
            renderer.render('Test message');

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create #message-list element dynamically using .create()'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Critical: Failed to find or create #message-list. Messages will not be displayed.'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot render message: #message-list element is invalid, not found, or unappendable.'));

            const currentMessageListDOM = document.getElementById('message-list');
            if (currentMessageListDOM) {
                expect(currentMessageListDOM.querySelector('li')).toBeNull();
            }
            expect(mockDomElementFactoryInstance.li).not.toHaveBeenCalled();
            currentQueryMock.mockRestore();
            currentCreateMock.mockRestore();
        });


        it('should log error and not render if DomElementFactory is missing', () => {
            const renderer = createRenderer(null);
            renderer.render('Test message');

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('DomElementFactory dependency is missing or invalid.'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot render message: DomElementFactory is missing.'));
            const currentMessageList = document.getElementById('message-list');
            if (currentMessageList) expect(currentMessageList.innerHTML).toBe('');
        });

        it('should log error if DOM element factory fails to create li', () => {
            const currentLiMock = jest.spyOn(mockDomElementFactoryInstance, 'li').mockReturnValue(null);
            const renderer = createRenderer();
            renderer.render('Test message', 'info');

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create message item (li) element using DomElementFactory.'));
            if (messageList) expect(messageList.innerHTML).toBe('');
            currentLiMock.mockRestore();
        });

        it('should handle dispose being called multiple times gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReset().mockReturnValue(mockSubscription);
            const renderer = createRenderer();
            renderer.dispose();
            renderer.dispose();
            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(4);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[UiMessageRenderer] Disposing.'));
        });

        it('should handle scrolling correctly', () => {
            const renderer = createRenderer();
            const targetOutputDiv = renderer["_UiMessageRenderer__outputDivElement"];
            expect(targetOutputDiv).not.toBeNull();

            Object.defineProperty(targetOutputDiv, 'scrollHeight', {configurable: true, writable: true, value: 0});
            Object.defineProperty(targetOutputDiv, 'scrollTop', {configurable: true, writable: true, value: 0});

            targetOutputDiv.scrollHeight = 500;
            renderer.render('Message 1');
            expect(targetOutputDiv.scrollTop).toBe(500);

            // Test fallback
            renderer["_UiMessageRenderer__outputDivElement"] = null;

            // Ensure docContext.query also returns null for #outputDiv for this specific part of the test
            const originalDocQuery = docContext.query; // Store the mock implementation from beforeEach
            const tempQueryMock = jest.spyOn(docContext, 'query').mockImplementation(selector => {
                if (selector === '#outputDiv') return null;
                if (selector === '#message-list') return document.getElementById('message-list');
                // For any other selector, you might want to call the originalQuery if it was more complex
                // or just fallback to JSDOM's default if originalQuery was also a simple mock.
                // In this case, the beforeEach mock is already quite specific.
                return dom.window.document.querySelector(selector);
            });

            const lastChildMock = {scrollIntoView: jest.fn()};
            const currentMessageList = renderer["_UiMessageRenderer__messageList"];
            if (currentMessageList) {
                Object.defineProperty(currentMessageList, 'lastChild', {
                    configurable: true,
                    value: lastChildMock
                });
            } else {
                throw new Error("MessageList is unexpectedly null for scroll fallback test.");
            }

            renderer.render('Message 2');
            expect(lastChildMock.scrollIntoView).toHaveBeenCalledWith({behavior: 'auto', block: 'end'});

            tempQueryMock.mockRestore(); // Restore to the query mock defined in beforeEach
                                         // or originalDocQuery.mockRestore() if originalDocQuery was a spy on real method.
                                         // Since docContext.query is already a mock from beforeEach, restoring the spy is fine.

            // Restore outputDivElement on the instance if needed for further actions in this test (not in this case)
            if (targetOutputDiv) renderer["_UiMessageRenderer__outputDivElement"] = targetOutputDiv;
        });
    });
});