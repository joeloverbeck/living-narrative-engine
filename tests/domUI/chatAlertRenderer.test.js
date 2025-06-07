// tests/domUI/chatAlertRenderer.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatAlertRenderer } from '../../src/domUI/index.js';
import { Throttler } from '../../src/alerting/throttler.js';

// --- Mock Throttler ---
// By defining the mock implementation outside of the factory, we can control it from our tests.
const mockWarningAllow = jest.fn();
const mockErrorAllow = jest.fn();

jest.mock('../../src/alerting/throttler.js', () => ({
  Throttler: jest.fn().mockImplementation((dispatcher, severity) => {
    // Return the correct mock based on the severity it's initialized with
    if (severity === 'warning') {
      return { allow: mockWarningAllow };
    }
    return { allow: mockErrorAllow };
  }),
}));

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
    querySelector: jest.fn(function (selector) {
      const childNodes = this._childNodes || [];
      for (const node of childNodes) {
        if (!node.classList) continue;
        if (
          selector.startsWith('.') &&
          node.classList.contains(selector.substring(1))
        ) {
          return node;
        }
        if (node.tagName === selector.toUpperCase()) {
          return node;
        }
        if (typeof node.querySelector === 'function') {
          const found = node.querySelector(selector);
          if (found) return found;
        }
      }
      return null;
    }),
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
  Object.defineProperty(element, 'textContent', {
    get: function () {
      return (this._childNodes || [])
        .map((node) =>
          node.nodeType === 3 ? node.nodeValue : node.textContent || ''
        )
        .join('');
    },
    set: function (text) {
      this._childNodes = text ? [{ nodeType: 3, nodeValue: text }] : [];
    },
  });
  return element;
};

const createMockDocumentContext = (chatPanelExists = true) => {
  const mockChatPanel = chatPanelExists ? createMockElement('div') : null;
  if (mockChatPanel) mockChatPanel.id = 'message-list-mock';

  const findByIdRecursive = (id, node) => {
    if (!node) return null;
    if (node.id === id) return node;
    if (!node._childNodes) return null;
    for (const child of node._childNodes) {
      const found = findByIdRecursive(id, child);
      if (found) return found;
    }
    return null;
  };

  return {
    query: jest.fn((selector) => {
      if (selector === '#message-list') return mockChatPanel;
      if (selector.startsWith('#'))
        return findByIdRecursive(selector.substring(1), mockChatPanel);
      return null;
    }),
    create: jest.fn((tagName) => createMockElement(tagName)),
    _mockChatPanel: mockChatPanel,
  };
};

const createMockSafeEventDispatcher = () => ({
  _subscriptions: {},
  subscribe: jest.fn(function (eventName, callback) {
    this._subscriptions[eventName] = callback;
    return jest.fn();
  }),
  dispatch: jest.fn(),
  trigger: function (eventName, payload) {
    if (this._subscriptions[eventName])
      this._subscriptions[eventName]({ payload });
  },
});

const createMockDomElementFactory = () => {
  const factory = {
    create: jest.fn((tagName, options = {}) => {
      const el = createMockElement(tagName);
      if (options.cls)
        el.classList.add(
          ...(Array.isArray(options.cls) ? options.cls : options.cls.split(' '))
        );
      if (options.text) el.textContent = options.text;
      if (options.id) el.id = options.id;
      if (options.attrs)
        Object.entries(options.attrs).forEach(([k, v]) =>
          el.setAttribute(k, v)
        );
      return el;
    }),
  };
  factory.div = jest.fn((cls, options) =>
    factory.create('div', { ...options, cls })
  );
  factory.p = jest.fn((cls, options) =>
    factory.create('p', { ...options, cls })
  );
  factory.span = jest.fn((cls, text) => factory.create('span', { cls, text }));
  return factory;
};

const createMockAlertRouter = () => ({ notifyUIReady: jest.fn() });

describe('ChatAlertRenderer', () => {
  let mocks;

  const setup = (panelExists = true) => {
    const localMocks = {
      logger: createMockLogger(),
      documentContext: createMockDocumentContext(panelExists),
      /**
       * **THE FIX**: Renamed `validatedEventDispatcher` to `safeEventDispatcher`.
       * This now matches the updated constructor signature of `ChatAlertRenderer`,
       * ensuring the correct dependency is passed during test setup.
       */
      safeEventDispatcher: createMockSafeEventDispatcher(),
      domElementFactory: createMockDomElementFactory(),
      alertRouter: createMockAlertRouter(),
    };
    localMocks.mockChatPanel = localMocks.documentContext._mockChatPanel;

    const rendererInstance = new ChatAlertRenderer(localMocks);

    return { renderer: rendererInstance, mocks: localMocks };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const setupResult = setup();
    mocks = setupResult.mocks;
    mockWarningAllow.mockReturnValue(true);
    mockErrorAllow.mockReturnValue(true);
  });

  describe('Initialization', () => {
    it('should subscribe to warning and error events', () => {
      expect(mocks.safeEventDispatcher.subscribe).toHaveBeenCalledWith(
        'ui:display_warning',
        expect.any(Function)
      );
      expect(mocks.safeEventDispatcher.subscribe).toHaveBeenCalledWith(
        'ui:display_error',
        expect.any(Function)
      );
    });

    it('should instantiate two separate Throttlers for warnings and errors', () => {
      expect(Throttler).toHaveBeenCalledTimes(2);
      expect(Throttler).toHaveBeenCalledWith(
        mocks.safeEventDispatcher,
        'warning'
      );
      expect(Throttler).toHaveBeenCalledWith(
        mocks.safeEventDispatcher,
        'error'
      );
    });
  });

  describe('Throttling Logic', () => {
    it('should NOT render a warning bubble if warning throttler returns false', () => {
      mockWarningAllow.mockReturnValue(false);
      mocks.safeEventDispatcher.trigger('ui:display_warning', {
        details: {},
      });
      expect(mockWarningAllow).toHaveBeenCalled();
      expect(mockErrorAllow).not.toHaveBeenCalled();
      expect(mocks.mockChatPanel.appendChild).not.toHaveBeenCalled();
    });

    it('should NOT render an error bubble if error throttler returns false', () => {
      mockErrorAllow.mockReturnValue(false);
      mocks.safeEventDispatcher.trigger('ui:display_error', {
        details: {},
      });
      expect(mockErrorAllow).toHaveBeenCalled();
      expect(mockWarningAllow).not.toHaveBeenCalled();
      expect(mocks.mockChatPanel.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('DOM & Logic Tests', () => {
    it('should render a warning bubble when panel is present and throttler allows', () => {
      const message = 'This is a test warning.';
      mocks.safeEventDispatcher.trigger('ui:display_warning', {
        message,
        details: {},
      });

      expect(mocks.mockChatPanel.appendChild).toHaveBeenCalledTimes(1);
      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      // FIXED: Assert against the correct camelCase class name.
      expect(bubble.classList.contains('chat-warningBubble')).toBe(true);
    });

    it('should log to console when panel is not present', () => {
      const { mocks: localMocks } = setup(false);
      mockWarningAllow.mockReturnValue(true);

      const message = 'Console warning.';
      localMocks.safeEventDispatcher.trigger('ui:display_warning', {
        message,
        details: {},
      });

      expect(localMocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });
  describe('Truncation and developer details', () => {
    it('truncates long messages and toggles on click', () => {
      const longMsg = 'x'.repeat(250);
      mocks.safeEventDispatcher.trigger('ui:display_warning', {
        message: longMsg,
        details: {},
      });

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const msgEl = bubble.querySelector('.chat-alert-message');
      const toggleBtn = bubble.querySelector('.chat-alert-toggle');
      toggleBtn.dataset.toggleType = 'message';

      expect(msgEl.textContent.length).toBe(201);
      expect(toggleBtn.textContent).toBe('Show more');

      mocks.mockChatPanel._eventListeners.click({ target: toggleBtn });
      expect(msgEl.textContent).toBe(longMsg);
      expect(toggleBtn.textContent).toBe('Show less');
    });

    it('renders mapped message and escaped developer details for status code 503', () => {
      const payload = {
        details: {
          statusCode: 503,
          url: '/api/x',
          raw: '503 Service Unavailable',
        },
      };
      mocks.safeEventDispatcher.trigger('ui:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const msgEl = bubble.querySelector('.chat-alert-message');
      expect(msgEl.textContent).toBe(
        'Service temporarily unavailable. Please retry in a moment.'
      );
      const pre = bubble.querySelector('pre');
      const code = pre.querySelector('code');
      expect(code.textContent).toBe('503 503 Service Unavailable at /api/x');
      expect(pre.hidden).toBe(true);
    });

    it('escapes malicious details content', () => {
      const payload = {
        message: 'Oops',
        details: {
          statusCode: 500,
          url: '/bad',
          raw: '<img src=x onerror=alert(1)>',
        },
      };
      mocks.safeEventDispatcher.trigger('ui:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe(
        '500 &lt;img src=x onerror=alert(1)&gt; at /bad'
      );
    });
  });
});
