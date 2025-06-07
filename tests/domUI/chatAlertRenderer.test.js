// tests/domUI/chatAlertRenderer.test.js
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ChatAlertRenderer } from '../../src/domUI/index.js';
import { escapeHtml } from '../../src/utils/textUtils.js';

// --- Mock Factories ---

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockElement = (tagName = 'div') => {
  const element = {
    tagName: tagName.toUpperCase(),
    classList: {
      _classes: new Set(),
      add: jest.fn(function (...classNames) {
        classNames.forEach((c) => this._classes.add(c));
      }),
      contains: jest.fn(function (className) {
        return this._classes.has(className);
      }),
    },
    dataset: {},
    style: {},
    _attributes: {},
    _childNodes: [],
    _eventListeners: {},
    parentNode: null,
    appendChild: jest.fn(function (child) {
      this._childNodes.push(child);
      child.parentNode = this;
    }),
    setAttribute: jest.fn(function (name, value) {
      this._attributes[name] = value;
    }),
    getAttribute: jest.fn(function (name) {
      return this._attributes[name];
    }),
    addEventListener: jest.fn(function (type, listener) {
      this._eventListeners[type] = listener;
    }),
    removeEventListener: jest.fn(function (type) {
      delete this._eventListeners[type];
    }),
    // Simulate querySelector for finding child elements
    querySelector: jest.fn(function (selector) {
      const childNodes = this._childNodes || [];
      for (const node of childNodes) {
        let matches = false;
        if (selector.startsWith('.') && node.classList) {
          matches = node.classList.contains(selector.substring(1));
        } else if (node.tagName === selector.toUpperCase()) {
          matches = true;
        }

        if (matches) {
          return node;
        }

        if (typeof node.querySelector === 'function') {
          const found = node.querySelector(selector);
          if (found) return found;
        }
      }
      return null;
    }),
    // Simulate closest for event delegation tests
    closest: jest.fn(function (selector) {
      if (
        this.classList &&
        this.classList.contains(selector.replace('.', ''))
      ) {
        return this;
      }
      return null;
    }),
    focus: jest.fn(),
  };
  // Define textContent setter and getter
  Object.defineProperty(element, 'textContent', {
    get: function () {
      return (this._childNodes || [])
        .map((node) => {
          if (node.nodeType === 3) return node.nodeValue;
          if (node.textContent) return node.textContent;
          return '';
        })
        .join('');
    },
    set: function (text) {
      this._childNodes = [];
      if (text) {
        this._childNodes.push({ nodeType: 3, nodeValue: text });
      }
    },
  });
  return element;
};

const createMockDocumentContext = (chatPanelExists = true) => {
  const mockChatPanel = chatPanelExists ? createMockElement('div') : null;

  // FIX: This function performs a proper recursive search for an ID.
  const findByIdRecursive = (id, node) => {
    if (!node || typeof node.querySelector !== 'function') {
      return null;
    }
    if (node.id === id) {
      return node;
    }
    for (const child of node._childNodes) {
      const found = findByIdRecursive(id, child);
      if (found) {
        return found;
      }
    }
    return null;
  };

  return {
    query: jest.fn((selector) => {
      if (selector === '#message-list') {
        return mockChatPanel;
      }
      // FIX: Use the robust recursive search for ID selectors.
      if (selector.startsWith('#')) {
        const id = selector.substring(1);
        return findByIdRecursive(id, mockChatPanel);
      }
      return null;
    }),
    create: jest.fn((tagName) => createMockElement(tagName)),
    _mockChatPanel: mockChatPanel,
  };
};

const createMockValidatedEventDispatcher = () => ({
  _subscriptions: {},
  subscribe: jest.fn(function (eventName, callback) {
    this._subscriptions[eventName] = callback;
    return jest.fn(); // Return unsubscribe function
  }),
  dispatchValidated: jest.fn(),
  // Helper to trigger a subscribed event
  trigger: function (eventName, payload) {
    if (this._subscriptions[eventName]) {
      this._subscriptions[eventName]({ payload });
    }
  },
});

const createMockDomElementFactory = () => {
  const factory = {
    create: jest.fn((tagName, options = {}) => {
      const el = createMockElement(tagName);
      if (options.cls) {
        // Ensure classList.add is called correctly if it's a string
        const classes = Array.isArray(options.cls)
          ? options.cls
          : options.cls.split(' ');
        el.classList.add(...classes);
      }
      if (options.text) el.textContent = options.text;
      if (options.id) el.id = options.id;
      if (options.attrs) {
        for (const [key, value] of Object.entries(options.attrs)) {
          el.setAttribute(key, value);
        }
      }
      return el;
    }),
  };
  factory.div = jest
    .fn()
    .mockImplementation((cls) => factory.create('div', { cls }));
  factory.p = jest
    .fn()
    .mockImplementation((cls) => factory.create('p', { cls }));
  factory.span = jest
    .fn()
    .mockImplementation((cls, text) => factory.create('span', { cls, text }));
  return factory;
};

const createMockAlertRouter = () => ({
  notifyUIReady: jest.fn(),
});

const createMockAlertMessageFormatter = () => ({
  format: jest.fn(),
});

describe('ChatAlertRenderer', () => {
  // FIX: These will be populated by a refactored createRenderer helper.
  let renderer;
  let mocks;

  // FIX: Refactored helper to return all created mocks for independent test use.
  const setup = (panelExists = true) => {
    const logger = createMockLogger();
    const documentContext = createMockDocumentContext(panelExists);
    const validatedEventDispatcher = createMockValidatedEventDispatcher();
    const domElementFactory = createMockDomElementFactory();
    const alertRouter = createMockAlertRouter();
    const alertMessageFormatter = createMockAlertMessageFormatter();
    const mockChatPanel = documentContext._mockChatPanel;

    const rendererInstance = new ChatAlertRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      domElementFactory,
      alertRouter,
      alertMessageFormatter,
    });

    return {
      renderer: rendererInstance,
      mocks: {
        logger,
        documentContext,
        validatedEventDispatcher,
        domElementFactory,
        alertRouter,
        alertMessageFormatter,
        mockChatPanel,
      },
    };
  };

  describe('Initialization', () => {
    it('should subscribe to warning and error events', () => {
      const { mocks } = setup();
      expect(mocks.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'ui:display_warning',
        expect.any(Function)
      );
      expect(mocks.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'ui:display_error',
        expect.any(Function)
      );
    });

    it('should notify AlertRouter that UI is ready if chat panel exists', () => {
      const { mocks } = setup(true);
      expect(mocks.alertRouter.notifyUIReady).toHaveBeenCalled();
    });

    it('should NOT notify AlertRouter if chat panel does not exist', () => {
      const { mocks } = setup(false);
      expect(mocks.alertRouter.notifyUIReady).not.toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Chat panel ('#message-list') not found. This renderer will not display any alerts."
        )
      );
    });
  });

  describe('DOM & Logic Tests', () => {
    beforeEach(() => {
      const { renderer: r, mocks: m } = setup();
      renderer = r;
      mocks = m;
    });

    it('Test 1: should render a warning bubble when panel is present', () => {
      const message = 'This is a test warning.';
      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: message,
        developerDetails: null,
      });

      mocks.validatedEventDispatcher.trigger('ui:display_warning', {
        details: { message },
      });

      expect(mocks.mockChatPanel.appendChild).toHaveBeenCalledTimes(1);
      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      expect(bubble.classList.contains('chat-warning-bubble')).toBe(true);

      const messageElement = bubble.querySelector('.chat-alert-message');
      expect(messageElement).toBeDefined();
      expect(messageElement.textContent).toBe(escapeHtml(message));
    });

    it('Test 2: should log to console when panel is not present', () => {
      // FIX: Use the returned mocks from a specific setup call.
      const { renderer: rendererWithoutPanel, mocks: localMocks } =
        setup(false);

      const message = 'This is a test error.';
      const details = 'Error detail.';
      localMocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: message,
        developerDetails: details,
      });

      localMocks.validatedEventDispatcher.trigger('ui:display_error', {
        details: { message, details },
      });

      expect(rendererWithoutPanel.elements.chatPanel).toBeNull();
      expect(localMocks.logger.error).toHaveBeenCalledWith(
        `[UI ERROR] ${message} | Details: ${details}`
      );
    });

    it('Test 4: should render HTML-escaped text', () => {
      const xssPayload = "<script>alert('XSS')</script>";
      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: xssPayload,
        developerDetails: null,
      });

      mocks.validatedEventDispatcher.trigger('ui:display_warning', {
        details: { message: xssPayload },
      });

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const messageElement = bubble.querySelector('.chat-alert-message');
      expect(messageElement).toBeDefined();
      expect(messageElement.textContent).toBe(escapeHtml(xssPayload));
    });
  });

  describe('Truncation & Toggling (Test 3)', () => {
    const longMessage = 'a'.repeat(250);
    const truncatedMessage = longMessage.substring(0, 200) + '…';

    beforeEach(() => {
      const { renderer: r, mocks: m } = setup();
      renderer = r;
      mocks = m;

      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: longMessage,
        developerDetails: null,
      });
      mocks.validatedEventDispatcher.trigger('ui:display_warning', {
        details: { message: longMessage },
      });
    });

    it('should initially render truncated text and a "Show more" button', () => {
      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const messageElement = bubble.querySelector('.chat-alert-message');
      const toggleButton = bubble.querySelector('.chat-alert-toggle');

      expect(messageElement.textContent).toBe(truncatedMessage);
      expect(messageElement.dataset.fullText).toBe(longMessage);
      expect(toggleButton).toBeDefined();
      expect(toggleButton.textContent).toBe('Show more');
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });

    it('should collapse the text on second click', () => {
      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const messageElement = bubble.querySelector('.chat-alert-message');
      const toggleButton = bubble.querySelector('.chat-alert-toggle');
      const clickHandler = mocks.mockChatPanel._eventListeners['click'];

      clickHandler({ target: toggleButton });
      clickHandler({ target: toggleButton });

      expect(messageElement.textContent).toBe(truncatedMessage);
      expect(toggleButton.textContent).toBe('Show more');
      expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Accessibility & Mapping Tests', () => {
    beforeEach(() => {
      const { renderer: r, mocks: m } = setup();
      renderer = r;
      mocks = m;
    });

    it('Test 5: should set correct ARIA attributes for warnings and errors', () => {
      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: 'A warning',
      });
      mocks.validatedEventDispatcher.trigger('ui:display_warning', {
        details: {},
      });
      let bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      expect(bubble.getAttribute('role')).toBe('status');
      expect(bubble.getAttribute('aria-live')).toBe('polite');
      let icon = bubble.querySelector('.chat-alert-icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');

      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: 'An error',
      });
      mocks.validatedEventDispatcher.trigger('ui:display_error', {
        details: {},
      });
      bubble = mocks.mockChatPanel.appendChild.mock.calls[1][0];
      expect(bubble.getAttribute('role')).toBe('alert');
      expect(bubble.getAttribute('aria-live')).toBe('assertive');
      icon = bubble.querySelector('.chat-alert-icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('Test 6: should create a focusable "Show more" button and not move focus', () => {
      const longMessage = 'a'.repeat(250);
      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: longMessage,
      });

      mocks.validatedEventDispatcher.trigger('ui:display_warning', {
        details: { message: longMessage },
      });

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const toggleButton = bubble.querySelector('.chat-alert-toggle');
      expect(toggleButton.tagName).toBe('BUTTON');

      const focusSpy = jest.spyOn(toggleButton, 'focus');
      const clickHandler = mocks.mockChatPanel._eventListeners['click'];
      expect(clickHandler).toBeDefined();
      clickHandler({ target: toggleButton });

      expect(focusSpy).not.toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('Test 7: should map status codes and render a collapsed developer details section', () => {
      const userMessage = 'Service temporarily unavailable...';
      const devDetails = '503 Service Unavailable';
      mocks.alertMessageFormatter.format.mockReturnValue({
        displayMessage: userMessage,
        developerDetails: devDetails,
      });

      mocks.validatedEventDispatcher.trigger('ui:display_error', {
        details: { statusCode: 503 },
      });

      expect(mocks.alertMessageFormatter.format).toHaveBeenCalledWith({
        statusCode: 503,
      });
      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];

      const messageElement = bubble.querySelector('.chat-alert-message');
      expect(messageElement.textContent).toBe(escapeHtml(userMessage));

      const detailsContainer = bubble.querySelector(
        '.chat-alert-details-container'
      );
      expect(detailsContainer).toBeDefined();
      const toggleButton = detailsContainer.querySelector('.chat-alert-toggle');
      expect(toggleButton).toBeDefined();
      expect(toggleButton.textContent).toBe('Developer details');

      const preElement = detailsContainer.querySelector('.chat-alert-details');
      expect(preElement).toBeDefined();
      expect(preElement.hidden).toBe(true);
      const codeElement = preElement.querySelector('code');
      expect(codeElement.textContent).toBe(escapeHtml(devDetails));
    });
  });
});
