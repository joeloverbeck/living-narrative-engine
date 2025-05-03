// src/tests/domUI/uiMessageRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {UiMessageRenderer} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext';
import ConsoleLogger from '../../core/services/consoleLogger'; // Assuming ConsoleLogger implements ILogger
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher'; // Assuming this implements IValidatedEventDispatcher

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');

describe('UiMessageRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let container;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="messages"></div></body></html>`);
        document = dom.window.document;
        docContext = new DocumentContext(document.body); // Pass body element

        // Clear mocks and create new instances for each test
        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger); // Assuming constructor args

        // Spy on logger methods
        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        container = document.getElementById('messages'); // Default container
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Clean up DOM
    });

    // --- Helper to create renderer ---
    const createRenderer = (selector = '#messages', options = {}) => {
        return new UiMessageRenderer(mockLogger, docContext, mockVed, selector, options);
    };

    // --- Test Scenarios ---

    describe('Default Selector (#messages)', () => {
        it('should render info message with default options (allowHtml=false)', () => {
            const renderer = createRenderer();
            const text = 'Info message test';
            renderer.render(text, 'info');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.innerHTML).not.toBe(text); // Should not interpret HTML
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should render fatal error message with default options (allowHtml=false)', () => {
            const renderer = createRenderer();
            const text = 'Fatal error test';
            renderer.render(text, 'fatal');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should render command echo message with default options (allowHtml=false)', () => {
            const renderer = createRenderer();
            const text = '> look around';
            renderer.render(text, 'echo');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should render info message respecting constructor allowHtml=true', () => {
            const renderer = createRenderer('#messages', {allowHtml: true});
            const text = 'Info <b>bold</b> test';
            renderer.render(text, 'info');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Info bold test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });

        it('should render fatal message respecting constructor allowHtml=true', () => {
            const renderer = createRenderer('#messages', {allowHtml: true});
            const text = 'Fatal <i>italic</i> test';
            renderer.render(text, 'fatal');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Fatal italic test');
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });

        it('should render echo message respecting constructor allowHtml=true', () => {
            const renderer = createRenderer('#messages', {allowHtml: true});
            const text = '> look <u>underlined</u>';
            renderer.render(text, 'echo');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('> look underlined');
            expect(messageElement.classList.contains('message-echo')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });

        it('should allow render options to override constructor allowHtml (true overrides false)', () => {
            const renderer = createRenderer('#messages', {allowHtml: false}); // Constructor default
            const text = 'Render <b>override</b> test';
            renderer.render(text, 'info', {allowHtml: true}); // Render option

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Render override test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });

        it('should allow render options to override constructor allowHtml (false overrides true)', () => {
            const renderer = createRenderer('#messages', {allowHtml: true}); // Constructor sets true
            const text = 'Render <b>override</b> test';
            renderer.render(text, 'info', {allowHtml: false}); // Render option sets false

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            // textContent should be the raw text, innerHTML should have escaped HTML
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.innerHTML).toBe('Render &lt;b&gt;override&lt;/b&gt; test');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });
    });

    describe('Custom Selector', () => {
        const customSelector = '#custom-output';

        beforeEach(() => {
            // Create the custom container
            const customContainer = document.createElement('div');
            customContainer.id = 'custom-output';
            document.body.appendChild(customContainer);
            container = customContainer; // Update reference for assertions
        });

        it('should render info message in custom container (allowHtml=false)', () => {
            const renderer = createRenderer(customSelector);
            const text = 'Custom container info';
            renderer.render(text, 'info');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
            expect(document.getElementById('messages').innerHTML).toBe(''); // Default container should be empty
        });

        it('should render fatal message in custom container (allowHtml=false)', () => {
            const renderer = createRenderer(customSelector);
            const text = 'Custom container fatal';
            renderer.render(text, 'fatal');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-fatal')).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });

        it('should render info message with HTML in custom container (allowHtml=true)', () => {
            const renderer = createRenderer(customSelector, {allowHtml: true});
            const text = 'Custom <b>HTML</b> info';
            renderer.render(text, 'info');

            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement.innerHTML).toBe(text);
            expect(messageElement.textContent).toBe('Custom HTML info');
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });
    });

    describe('Custom Tags', () => {
        it('should use custom container and message tags from options', () => {
            const renderer = createRenderer('#messages', {
                messageContainerTag: 'ul',
                messageElementTag: 'li',
            });
            // The default div#messages still exists, but ensureContainer should create a new one if necessary
            // Let's remove the default one first to be sure.
            document.getElementById('messages').remove();

            const text = 'List item message';
            renderer.render(text, 'info');

            const listContainer = document.getElementById('messages');
            expect(listContainer).not.toBeNull();
            expect(listContainer.tagName).toBe('UL');

            const messageElement = listContainer.querySelector('li');
            expect(messageElement).not.toBeNull();
            expect(messageElement.tagName).toBe('LI');
            expect(messageElement.textContent).toBe(text);
            expect(messageElement.classList.contains('message-info')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(`[Ui::UiMessageRenderer] ${text}`);
        });
    });

    describe('Error Handling', () => {
        it('should log warning if selector is invalid', () => {
            // Hide expected console error from JSDOM/CSSSelecter for this specific test
            const spyConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            const renderer = createRenderer('invalid///selector');
            renderer.render('Test message');

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid selector'));
            expect(container.innerHTML).toBe(''); // No message should be added

            spyConsoleError.mockRestore(); // Restore console.error
        });

        it('should log warning if selector does not find an element', () => {
            const renderer = createRenderer('#non-existent-element');
            renderer.render('Test message');

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Message container "#non-existent-element" not found'));
            expect(document.getElementById('messages').innerHTML).toBe(''); // Default container is empty
            expect(document.getElementById('non-existent-element')).toBeNull(); // Target container doesn't exist
        });

        it('should log warning and return if container cannot be ensured', () => {
            // Mock docContext.query to simulate failure even after creation attempt
            jest.spyOn(docContext, 'query').mockReturnValue(null);
            const renderer = createRenderer('#messages'); // Use a valid selector initially
            renderer.render('Test message');

            // It should try to find/create, fail, and log warn twice (find + create attempt)
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Message container "#messages" not found. Attempting to create.'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to ensure message container "#messages" exists.'));
            // Ensure no logs of the message itself happened
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });
});