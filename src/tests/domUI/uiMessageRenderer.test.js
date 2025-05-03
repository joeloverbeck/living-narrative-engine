// src/tests/domUI/uiMessageRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {UiMessageRenderer} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext';
import DomElementFactory from '../../domUI/domElementFactory'; // <-- Import DomElementFactory
import ConsoleLogger from '../../core/services/consoleLogger';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
jest.mock('../../domUI/domElementFactory'); // <-- Mock DomElementFactory

describe('UiMessageRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactory; // <-- Declare mockDomElementFactory
    let container;
    let messageList; // Define messageList here

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="main-content"><ul id="message-list"></ul></div></body></html>`); // Ensure #main-content and #message-list exist
        document = dom.window.document;
        docContext = new DocumentContext(document.body);

        // Clear mocks and create new instances for each test
        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger);
        mockDomElementFactory = new DomElementFactory(docContext); // <-- Instantiate mockDomElementFactory

        // Spy on logger methods
        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        // Spy on factory methods (and provide basic mock implementations)
        jest.spyOn(mockDomElementFactory, 'li').mockImplementation((cls, text) => { // Adjusted mock signature
            const li = document.createElement('li');
            // Helper to add classes based on factory logic
            const addClasses = (element, classes) => {
                if (!classes) return;
                if (Array.isArray(classes)) {
                    element.classList.add(...classes.filter(c => c));
                } else if (typeof classes === 'string') {
                    const clsArr = classes.split(' ').filter(c => c);
                    if (clsArr.length > 0) element.classList.add(...clsArr);
                }
            };
            addClasses(li, cls);
            if (text !== undefined) li.textContent = text;
            return li;
        });
        jest.spyOn(mockDomElementFactory, 'ul').mockImplementation((id, cls) => { // Adjusted mock signature
            const ul = document.createElement('ul');
            if (id) ul.id = id;
            // Helper to add classes based on factory logic
            const addClasses = (element, classes) => {
                if (!classes) return;
                if (Array.isArray(classes)) {
                    element.classList.add(...classes.filter(c => c));
                } else if (typeof classes === 'string') {
                    const clsArr = classes.split(' ').filter(c => c);
                    if (clsArr.length > 0) element.classList.add(...clsArr);
                }
            };
            addClasses(ul, cls);
            return ul;
        });


        // Mock documentContext.query specifically for #message-list to return the list
        messageList = document.getElementById('message-list');
        jest.spyOn(docContext, 'query'); // Spy on query generally
        docContext.query.mockImplementation((selector) => { // Provide general implementation
            if (selector === '#message-list') {
                // Use the potentially modified messageList variable
                return document.getElementById('message-list');
            }
            if (selector === '#main-content') {
                return document.getElementById('main-content');
            }
            // Fallback to original JSDOM querySelector for other selectors if needed
            return document.querySelector(selector);
        });


        container = messageList; // Messages are rendered into the messageList
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (document && document.body) {
            document.body.innerHTML = ''; // Clean up DOM
        }
    });

// --- Helper to create renderer ---
// --- FIX: Pass dependencies as a single object map ---
// --- FIX: Add mockDomElementFactory ---
// --- FIX: Remove selector and options from here, they are handled by the class itself ---
    const createRenderer = () => {
        return new UiMessageRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactory // <-- Pass the factory
        });
    };

// --- Test Scenarios ---

    describe('Rendering Messages', () => {
        it('should render info message', () => {
            const renderer = createRenderer();
            const text = 'Info message test';
            renderer.render(text, 'info');

            const messageElement = container.querySelector('li'); // Messages are LIs now
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message')).toBe(true);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });

        it('should render fatal error message', () => {
            const renderer = createRenderer();
            const text = 'Fatal error test';
            // Simulate fatal event
            renderer["_UiMessageRenderer__onShowFatal"]({message: text}); // Call private method for test


            const messageElement = container.querySelector('li'); // Messages are LIs
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Fatal error displayed: ${text}`));
        });

        it('should render fatal error message with Error details', () => {
            const renderer = createRenderer();
            const baseText = 'Fatal error occurred.';
            const errorDetails = 'Detailed reason.';
            const fullText = `${baseText}\nDetails: ${errorDetails}`;
            // Simulate fatal event with an error object
            renderer["_UiMessageRenderer__onShowFatal"]({
                message: baseText,
                error: new Error(errorDetails)
            });

            const messageElement = container.querySelector('li'); // Messages are LIs
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(fullText);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Fatal error displayed: ${fullText}`));
        });


        it('should render command echo message', () => {
            const renderer = createRenderer();
            const command = 'look around';
            const text = `> ${command}`;
            // Simulate echo event
            renderer["_UiMessageRenderer__onCommandEcho"]({originalInput: command});


            const messageElement = container.querySelector('li'); // Messages are LIs
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - ${text.substring(0, 50)}`));
        });

        it('should render info message with HTML when allowHtml is true', () => {
            const renderer = createRenderer();
            const text = 'Info <b>bold</b> test';
            renderer.render(text, 'info', true); // allowHtml = true

            const messageElement = container.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Info bold test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });

        it('should render info message without HTML when allowHtml is false (default)', () => {
            const renderer = createRenderer();
            const text = 'Info <b>bold</b> test';
            renderer.render(text, 'info', false); // allowHtml = false (or default)

            const messageElement = container.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text); // Text content should include tags
            expect(messageElement.innerHTML).toBe('Info &lt;b&gt;bold&lt;/b&gt; test'); // HTML should be escaped
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${text.substring(0, 50)}`));
        });

    });

    describe('Event Handling (VED Subscriptions)', () => {
        it('should subscribe to events on construction', () => {
            // createRenderer calls the constructor
            createRenderer();
            expect(mockVed.subscribe).toHaveBeenCalledTimes(4); // Check count based on constructor
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:display_message', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:action_executed', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:action_failed', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Subscribed to VED events.'));
        });

        it('should handle textUI:display_message event', () => {
            const renderer = createRenderer();
            const payload = {message: 'VED Message', type: 'info', allowHtml: false};
            // Manually trigger the handler that subscribe would have registered
            const displayMessageHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'textUI:display_message')[1];
            displayMessageHandler(payload);

            const messageElement = container.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(payload.message);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: info - ${payload.message.substring(0, 50)}`));
        });

        it('should handle core:system_error_occurred event', () => {
            const renderer = createRenderer();
            const payload = {message: 'VED Fatal Error'};
            // Manually trigger the handler
            const fatalHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:system_error_occurred')[1];
            fatalHandler(payload);

            const messageElement = container.querySelector('li');
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
            // Manually trigger the handler
            const echoHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_executed')[1];
            echoHandler(payload);


            const messageElement = container.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(`> ${command}`);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - > ${command.substring(0, 50)}`));
        });

        it('should handle core:action_failed event (echo)', () => {
            const renderer = createRenderer();
            const command = 'try something else';
            const payload = {originalInput: command};
            // Manually trigger the handler
            const echoFailedHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_failed')[1];
            echoFailedHandler(payload);


            const messageElement = container.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(`> ${command}`);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Rendered message: echo - > ${command.substring(0, 50)}`));
        });

        it('should ignore echo events without valid originalInput', () => {
            const renderer = createRenderer();
            // Manually trigger the handler with bad payload
            const echoHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:action_executed')[1];

            echoHandler({originalInput: null}); // Test null
            echoHandler({originalInput: ''}); // Test empty string
            echoHandler({}); // Test missing property

            const messageElements = container.querySelectorAll('li');
            expect(messageElements.length).toBe(0); // No message should be rendered
            expect(mockLogger.warn).toHaveBeenCalledTimes(3); // Called for each bad payload
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Received command echo event without valid originalInput.'), expect.anything());
        });

        it('should handle invalid display_message payload', () => {
            const renderer = createRenderer();
            // Manually trigger the handler with bad payload
            const displayMessageHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'textUI:display_message')[1];

            displayMessageHandler(null); // Test null payload
            displayMessageHandler({}); // Test empty object payload
            displayMessageHandler({message: 123}); // Test wrong message type

            const messageElements = container.querySelectorAll('li');
            expect(messageElements.length).toBe(0); // No message should be rendered
            expect(mockLogger.warn).toHaveBeenCalledTimes(3);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid 'textUI:display_message' payload."), expect.anything());
        });

        it('should handle invalid system_error_occurred payload', () => {
            const renderer = createRenderer();
            // Manually trigger the handler with bad payload
            const fatalHandler = mockVed.subscribe.mock.calls.find(call => call[0] === 'core:system_error_occurred')[1];

            fatalHandler(null); // Test null payload
            fatalHandler({}); // Test empty object payload
            fatalHandler({message: 123}); // Test wrong message type

            // It should render a generic fatal message
            const messageElement = container.querySelector('li.message-fatal'); // Query the original container
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe('An unspecified fatal system error occurred.');
            // Check logs - error for payload, debug for render
            expect(mockLogger.error).toHaveBeenCalledTimes(3);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Received invalid 'core:system_error_occurred' payload."), expect.anything());
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Rendered message: fatal - An unspecified fatal system error occurred."));
        });

        it('should unsubscribe from events on dispose', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);

            const renderer = createRenderer(); // This calls subscribe
            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(4); // Once for each subscription
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
        });
    });


    describe('Error Handling & Edge Cases', () => {
        it('should log error if message list cannot be found initially', () => {
            // Setup: Remove the list before creating the renderer
            document.getElementById('message-list').remove();
            // Spy on querySelector to ensure it returns null for #message-list
            docContext.query.mockImplementation((selector) => {
                if (selector === '#message-list') return null;
                if (selector === '#main-content') return document.getElementById('main-content'); // Allow finding main-content
                return document.querySelector(selector);
            });

            createRenderer(); // Constructor calls #ensureMessageList

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Could not find #message-list element!'));
            // Since #main-content exists and factory is mocked, it should *attempt* to create it
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('#message-list created dynamically.'));
            // --- FIX: Check only for the first argument ---
            expect(mockDomElementFactory.ul).toHaveBeenCalledWith('message-list');
            // Ensure it was added back to the DOM (ul mock returns a real element)
            expect(document.getElementById('message-list')).not.toBeNull();
            expect(document.getElementById('message-list').tagName).toBe('UL');
        });

        it('should log error if #main-content is missing during list creation', () => {
            // Setup: Remove both list and main content
            document.getElementById('message-list')?.remove();
            document.getElementById('main-content')?.remove();
            // Spy on querySelector to ensure it returns null for both
            docContext.query.mockImplementation((selector) => {
                if (selector === '#message-list' || selector === '#main-content') {
                    return null;
                }
                return document.querySelector(selector);
            });

            createRenderer(); // Constructor calls #ensureMessageList

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Could not find #message-list element!'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot find #main-content to append message list.'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to find or create #message-list.'));
            expect(mockDomElementFactory.ul).not.toHaveBeenCalled(); // Creation should not have been attempted
        });

        it('should log error and not render if message list is invalid after ensure', () => {
            // 1. Create renderer (ensure runs successfully initially)
            const renderer = createRenderer();
            // Verify it was found initially using the internal getter provided for testing
            expect(renderer["_UiMessageRenderer__messageList"]).not.toBeNull();
            expect(renderer["_UiMessageRenderer__messageList"].id).toBe('message-list');

            // 2. Re-configure mock to simulate list disappearing AFTER initial setup
            //    AND prevent its recreation.
            docContext.query.mockImplementation((selector) => {
                if (selector === '#message-list') {
                    return null; // Simulate it's gone from DOM query
                }
                if (selector === '#main-content') {
                    // Still allow finding main-content if ensure tries to recreate
                    return document.getElementById('main-content');
                }
                return document.querySelector(selector); // Fallback for other queries
            });
            // ALSO mock the factory to fail creating the UL if ensure tries that path
            mockDomElementFactory.ul.mockReturnValue(null);

            // 3. Sabotage the internal reference *just before* calling render
            renderer["_UiMessageRenderer__messageList"] = null;

            // 4. Call render.
            //    - It calls #ensureMessageList.
            //    - #ensureMessageList sees internal ref is null.
            //    - docContext.query('#message-list') returns null (due to mock).
            //    - domElementFactory.ul() returns null (due to mock).
            //    - #ensureMessageList fails to set this.#messageList.
            //    - render proceeds to check if this.#messageList is valid.
            //    - The check `!this.#messageList` is now true.
            renderer.render('Test message');

            // 5. Assert the expected error log from the check in render()
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot render message, list element invalid or not found.'));
            // The original container (messageList initially assigned to container var) might have been removed or replaced
            // Check that the *current* message list in the DOM (if any) is empty, or simply that the render didn't add an LI.
            const currentMessageList = document.getElementById('message-list');
            if (currentMessageList) {
                expect(currentMessageList.querySelector('li')).toBeNull();
            } else {
                // If the list couldn't even be recreated, that's fine too.
                // The main point is no 'li' was added.
                expect(document.querySelector('#message-list li')).toBeNull();
            }
            // Also ensure factory wasn't called to make an LI
            expect(mockDomElementFactory.li).not.toHaveBeenCalled();
        });


        it('should log error and not render if DomElementFactory is missing', () => {
            // Create renderer *without* the factory
            const renderer = new UiMessageRenderer({
                logger: mockLogger,
                documentContext: docContext,
                validatedEventDispatcher: mockVed,
                domElementFactory: null // <-- Set factory to null
            });

            renderer.render('Test message');

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot render message, DomElementFactory is missing.'));
            const currentMessageList = document.getElementById('message-list');
            expect(currentMessageList.innerHTML).toBe(''); // List exists but should be empty
        });

        it('should log error if DOM element factory fails to create li', () => {
            // Mock the factory to return null for li creation
            mockDomElementFactory.li.mockReturnValue(null);

            const renderer = createRenderer();
            renderer.render('Test message', 'info');

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create message item element.'));
            expect(container.innerHTML).toBe(''); // No item should be appended
        });

        it('should handle dispose being called multiple times gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose(); // Call again

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(4); // Should only be called once per subscription
            // Base dispose log might be called twice, but subscription log only once
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.')); // Logged on first call
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[UiMessageRenderer] Disposing.')); // Base class log (called potentially twice, check at least once)
        });

        it('should handle scrolling correctly', () => {
            const renderer = createRenderer();
            // Get the actual message list element via the test accessor
            const actualMessageList = renderer["_UiMessageRenderer__messageList"];
            expect(actualMessageList).not.toBeNull(); // Ensure it exists

            // Mock scroll properties/methods on the *actual* element
            const scrollIntoViewMock = jest.fn();
            Object.defineProperty(actualMessageList, 'scrollHeight', {configurable: true, value: 500});
            Object.defineProperty(actualMessageList, 'scrollTop', {configurable: true, writable: true, value: 0});
            actualMessageList.scrollIntoView = scrollIntoViewMock; // Attach mock method


            renderer.render('Message 1');
            // Check direct scroll assignment first
            expect(actualMessageList.scrollTop).toBe(500);


            // Test fallback if scrollTop isn't defined (less likely with JSDOM but good coverage)
            Object.defineProperty(actualMessageList, 'scrollTop', {configurable: true, value: undefined}); // Make scrollTop undefined
            renderer.render('Message 2');
            expect(scrollIntoViewMock).toHaveBeenCalledWith({behavior: 'smooth', block: 'end'});
        });

    });
});