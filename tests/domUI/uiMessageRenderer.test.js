// tests/domUI/uiMessageRenderer.test.js
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { UiMessageRenderer } from '../../src/domUI';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import {
  ACTION_FAILED_ID,
  DISPLAY_MESSAGE_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../src/constants/eventIds.js';

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');

describe('UiMessageRenderer', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let outputDivElement; // Renamed to match this.elements key
  let messageListElement; // Renamed to match this.elements key

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="outputDiv"><ul id="message-list"></ul></div></body></html>`
    );
    document = dom.window.document;
    docContext = new DocumentContext(document.body);

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher(null, mockLogger);
    mockDomElementFactoryInstance = new DomElementFactory(docContext);

    jest.spyOn(mockLogger, 'info').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'error').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});

    jest
      .spyOn(mockDomElementFactoryInstance, 'li')
      .mockImplementation((cls, text) => {
        const liEl = document.createElement('li');
        const addClasses = (element, classes) => {
          if (!classes) return;
          if (Array.isArray(classes)) {
            element.classList.add(...classes.filter((c) => c));
          } else if (typeof classes === 'string') {
            const clsArr = classes.split(' ').filter((c) => c);
            if (clsArr.length > 0) element.classList.add(...clsArr);
          }
        };
        addClasses(liEl, cls);
        if (text !== undefined) liEl.textContent = text;
        return liEl;
      });

    jest
      .spyOn(mockDomElementFactoryInstance, 'create')
      .mockImplementation((tagName, options) => {
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
        return document.createElement(tagName);
      });

    outputDivElement = document.getElementById('outputDiv');
    messageListElement = document.getElementById('message-list');

    jest.spyOn(docContext, 'query').mockImplementation((selector) => {
      if (selector === '#message-list') {
        return document.getElementById('message-list'); // Will be messageListElement post-construction
      }
      if (selector === '#outputDiv') {
        return document.getElementById('outputDiv'); // Will be outputDivElement post-construction
      }
      return dom.window.document.querySelector(selector);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (document && document.body) {
      document.body.innerHTML = '';
    }
  });

  const createRenderer = (factoryInstance = mockDomElementFactoryInstance) => {
    return new UiMessageRenderer({
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: factoryInstance,
    });
  };

  describe('Rendering Messages', () => {
    it('should render info message', () => {
      const renderer = createRenderer();
      const text = 'Info message test';
      renderer.render(text, 'info');

      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(text);
      expect(messageElement.classList.contains('message')).toBe(true);
      expect(messageElement.classList.contains('message-info')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: info - ${text.substring(0, 50)}`
        )
      );
    });

    it('should render fatal error message', () => {
      const renderer = createRenderer();
      const text = 'Fatal error test';
      // Invoke the handler via the VED mock
      const fatalHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
      )[1];
      fatalHandler({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: { message: text },
      });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(text);
      expect(messageElement.classList.contains('message-fatal')).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Fatal error displayed: ${text}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: fatal - ${text.substring(0, 50)}`
        )
      );
    });

    it('should render fatal error message with Error details', () => {
      const renderer = createRenderer();
      const baseText = 'Fatal error occurred.';
      const errorDetails = 'Detailed reason.';
      const fullText = `${baseText}\nDetails: ${errorDetails}`;
      const fatalHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
      )[1];
      fatalHandler({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: { message: baseText, error: new Error(errorDetails) },
      });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(fullText);
      expect(messageElement.classList.contains('message-fatal')).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Fatal error displayed: ${fullText}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: fatal - ${fullText.substring(0, 50)}`
        )
      );
    });

    it('should render command echo message', () => {
      const renderer = createRenderer();
      const command = 'look around';
      const text = `> ${command}`;
      const commandEchoHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === ACTION_FAILED_ID
      )[1];
      commandEchoHandler({
        type: ACTION_FAILED_ID,
        payload: { originalInput: command },
      });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(text);
      expect(messageElement.classList.contains('message-echo')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: echo - ${text.substring(0, 50)}`
        )
      );
    });

    it('should render info message with HTML when allowHtml is true', () => {
      const renderer = createRenderer();
      const text = 'Info <b>bold</b> test';
      renderer.render(text, 'info', true);
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.innerHTML).toBe(text);
      expect(messageElement.textContent).toBe('Info bold test');
      expect(messageElement.classList.contains('message-info')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: info - ${text.substring(0, 50)}`
        )
      );
    });

    it('should render info message without HTML when allowHtml is false (default)', () => {
      const renderer = createRenderer();
      const text = 'Info <b>bold</b> test';
      renderer.render(text, 'info', false);
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(text);
      expect(messageElement.innerHTML).toBe(
        'Info &lt;b&gt;bold&lt;/b&gt; test'
      );
      expect(messageElement.classList.contains('message-info')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: info - ${text.substring(0, 50)}`
        )
      );
    });
  });

  describe('Event Handling (VED Subscriptions)', () => {
    it('should subscribe to events on construction', () => {
      createRenderer();
      expect(mockVed.subscribe).toHaveBeenCalledTimes(3);
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        DISPLAY_MESSAGE_ID,
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        ACTION_FAILED_ID,
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to VED events.')
      );
    });

    it('should handle textUI:display_message event', () => {
      const renderer = createRenderer();
      const payload = {
        message: 'VED Message',
        type: 'info',
        allowHtml: false,
      };
      const displayMessageHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_MESSAGE_ID
      )[1];
      displayMessageHandler({ type: DISPLAY_MESSAGE_ID, payload: payload });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(payload.message);
      expect(messageElement.classList.contains('message-info')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: info - ${payload.message.substring(0, 50)}`
        )
      );
    });

    it('should handle core:system_error_occurred event', () => {
      const renderer = createRenderer();
      const payload = { message: 'VED Fatal Error' };
      const fatalHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
      )[1];
      fatalHandler({ type: SYSTEM_ERROR_OCCURRED_ID, payload: payload });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(payload.message);
      expect(messageElement.classList.contains('message-fatal')).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Fatal error displayed: ${payload.message}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: fatal - ${payload.message.substring(0, 50)}`
        )
      );
    });

    it('should handle core:action_failed event (echo)', () => {
      const renderer = createRenderer();
      const command = 'try something else';
      const payload = { originalInput: command };
      const echoFailedHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === ACTION_FAILED_ID
      )[1];
      echoFailedHandler({ type: ACTION_FAILED_ID, payload: payload });
      const messageElement = renderer.elements.messageList.querySelector('li');
      expect(messageElement).not.toBeNull();
      expect(messageElement.textContent).toBe(`> ${command}`);
      expect(messageElement.classList.contains('message-echo')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Rendered message: echo - > ${command.substring(0, 50)}`
        )
      );
    });

    it('should handle invalid display_message payload', () => {
      const renderer = createRenderer();
      mockLogger.warn.mockClear(); // Clear constructor/setup logs

      const displayMessageHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_MESSAGE_ID
      )[1];
      displayMessageHandler(null);
      displayMessageHandler({});
      displayMessageHandler({
        type: DISPLAY_MESSAGE_ID,
        payload: { message: 123 },
      });

      const messageElements =
        renderer.elements.messageList.querySelectorAll('li');
      expect(messageElements.length).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received invalid or malformed 'textUI:display_message' event object."
        ),
        expect.anything()
      );
    });

    it('should handle invalid system_error_occurred payload', () => {
      const renderer = createRenderer();
      mockLogger.error.mockClear(); // Clear constructor/setup logs
      mockLogger.debug.mockClear();

      const fatalHandler = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
      )[1];
      fatalHandler(null);
      fatalHandler({});
      fatalHandler({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: { message: 123 },
      });

      const messageElements =
        renderer.elements.messageList.querySelectorAll('li.message-fatal');
      expect(messageElements.length).toBe(3);
      messageElements.forEach((messageElement) => {
        expect(messageElement.textContent).toBe(
          'An unspecified fatal system error occurred.'
        );
      });
      expect(mockLogger.error).toHaveBeenCalledTimes(3); // 3 from handler + potentially others if not cleared
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received invalid 'core:system_error_occurred' payload."
        ),
        expect.anything()
      );
      // Each render call logs a debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Rendered message: fatal - An unspecified fatal system error occurred.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
    });

    it('should unsubscribe from events on dispose', () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      mockVed.subscribe.mockReset(); // Reset before createRenderer
      mockVed.subscribe.mockReturnValue(mockSubscription);

      const renderer = createRenderer();
      mockLogger.debug.mockClear(); // Clear constructor logs

      renderer.dispose();

      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(3);
      // Check for the specific log from RendererBase.dispose()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Starting disposal: Unsubscribing VED events and removing DOM listeners.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Unsubscribing 3 VED event subscriptions.'
        )
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should log info if message list cannot be found initially and then create it', () => {
      document.getElementById('message-list').remove();
      // Ensure docContext.query returns null for #message-list initially
      const originalDocQuery = docContext.query;
      const querySpy = jest
        .spyOn(docContext, 'query')
        .mockImplementation((selector) => {
          if (selector === '#message-list') return null; // Simulate not found
          if (selector === '#outputDiv')
            return document.getElementById('outputDiv');
          return originalDocQuery.call(docContext, selector);
        });
      mockLogger.info.mockClear(); // Clear previous info logs

      createRenderer();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '#message-list element not found by selector. Attempting to create it inside #outputDivElement.'
        )
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '#message-list created dynamically inside #outputDivElement and assigned to this.elements.messageList.'
        )
      );
      expect(mockDomElementFactoryInstance.create).toHaveBeenCalledWith('ul', {
        id: 'message-list',
        attrs: { 'aria-live': 'polite' },
      });
      expect(document.getElementById('message-list')).not.toBeNull();
      expect(document.getElementById('message-list').tagName).toBe('UL');
      querySpy.mockRestore();
    });

    it('should log errors if #outputDiv and #message-list are missing during list creation', () => {
      document.getElementById('message-list')?.remove();
      document.getElementById('outputDiv')?.remove();
      // Elements are already removed from the live JSDOM

      // Spy on docContext.query for this specific test's scenario
      const querySpy = jest
        .spyOn(docContext, 'query')
        .mockImplementation((selector) => {
          if (selector === '#message-list') return null;
          if (selector === '#outputDiv') return null;
          return dom.window.document.querySelector(selector); // Fallback
        });
      mockLogger.error.mockClear(); // Clear previous error logs
      mockLogger.info.mockClear();

      createRenderer();

      // Check BoundDomRendererBase logs (via super call)
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[UiMessageRenderer] Element 'outputDivElement' with selector '#outputDiv' not found. (Required)"
      );
      // Check UiMessageRenderer constructor logs
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot ensure #message-list exists: #outputDivElement (required container) also not found in this.elements.'
        )
      );

      const finalList = document.getElementById('message-list');
      expect(finalList).toBeNull();
      querySpy.mockRestore();
    });

    it('should log error and not render if message list is invalid after ensure (elements.messageList becomes null)', () => {
      const renderer = createRenderer();
      // Simulate messageList becoming null *after* construction for some reason
      renderer.elements.messageList = null;
      mockLogger.error.mockClear(); // Clear constructor logs

      renderer.render('Test message');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot render message: this.elements.messageList is invalid, not found, or unappendable.'
        )
      );
      expect(mockDomElementFactoryInstance.li).not.toHaveBeenCalled();
    });

    it('should log error and not render if DomElementFactory is missing', () => {
      // Constructor will log the first error about missing factory
      // Then render will log the second
      mockLogger.error.mockClear();
      const renderer = createRenderer(null); // Pass null for factory

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] DomElementFactory dependency is missing or invalid.'
        )
      );

      mockLogger.error.mockClear(); // Clear the constructor log to check the render log
      renderer.render('Test message');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Cannot render message: DomElementFactory is missing.'
        )
      );

      // Message list might exist from JSDOM setup, but should be empty
      const currentMessageList = document.getElementById('message-list');
      if (currentMessageList) expect(currentMessageList.innerHTML).toBe('');
    });

    it('should log error if DOM element factory fails to create li', () => {
      const renderer = createRenderer();
      jest.spyOn(mockDomElementFactoryInstance, 'li').mockReturnValue(null);
      mockLogger.error.mockClear(); // Clear constructor logs

      renderer.render('Test message', 'info');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to create message item (li) element using DomElementFactory.'
        )
      );
      if (renderer.elements.messageList)
        expect(renderer.elements.messageList.innerHTML).toBe('');
    });

    it('should handle dispose being called multiple times gracefully', () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      mockVed.subscribe.mockReset().mockReturnValue(mockSubscription);
      const renderer = createRenderer();
      mockLogger.debug.mockClear(); // Clear constructor logs

      renderer.dispose();
      renderer.dispose(); // Call dispose again

      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(3);
      // Check specific dispose logs from RendererBase and UiMessageRenderer
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Disposing UiMessageRenderer.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Starting disposal: Unsubscribing VED events and removing DOM listeners.'
        )
      );
      // The "Disposing subscriptions" comes from the old code, new code is more granular.
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[UiMessageRenderer] Unsubscribing 3 VED event subscriptions.'
        )
      );
    });

    it('should handle scrolling correctly', () => {
      const renderer = createRenderer();
      // Ensure elements are correctly fetched/created by the constructor
      expect(renderer.elements.outputDivElement).not.toBeNull();
      expect(renderer.elements.messageList).not.toBeNull();

      // Make outputDivElement scrollable for the test
      Object.defineProperty(
        renderer.elements.outputDivElement,
        'scrollHeight',
        {
          configurable: true,
          writable: true,
          value: 0,
        }
      );
      Object.defineProperty(renderer.elements.outputDivElement, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 0,
      });
      Object.defineProperty(
        renderer.elements.outputDivElement,
        'clientHeight',
        { configurable: true, value: 100 }
      );

      renderer.elements.outputDivElement.scrollHeight = 500;
      renderer.render('Message 1');
      expect(renderer.elements.outputDivElement.scrollTop).toBe(500);

      // Test fallback: Simulate outputDivElement becoming unavailable or unscrollable
      const originalOutputDiv = renderer.elements.outputDivElement;
      renderer.elements.outputDivElement = null; // Make it null for this part of the test

      const lastChildMock = { scrollIntoView: jest.fn() };
      // Ensure messageList has a lastChild
      if (!renderer.elements.messageList.lastChild) {
        const tempLi = document.createElement('li');
        renderer.elements.messageList.appendChild(tempLi);
      }
      Object.defineProperty(renderer.elements.messageList, 'lastChild', {
        configurable: true,
        value: lastChildMock,
      });

      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();

      renderer.render('Message 2');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not scroll #outputDivElement. Element or properties missing from this.elements. Attempting fallback scroll on #messageList.'
        )
      );
      expect(lastChildMock.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'end',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Fallback: Scrolled last message in #messageList into view.'
        )
      );

      renderer.elements.outputDivElement = originalOutputDiv; // Restore for cleanup or other tests
    });
  });
});
