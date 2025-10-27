import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatAlertRenderer } from '../../../src/domUI';
import { Throttler } from '../../../src/alerting/throttler.js';

// --- Mock Throttler ---
// By defining the mock implementation outside of the factory, we can control it from our tests.
const mockWarningAllow = jest.fn();
const mockErrorAllow = jest.fn();

jest.mock('../../../src/alerting/throttler.js', () => ({
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
      this._attributes[name] = value != null ? String(value) : value;
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

        // Handle complex selectors like '.class[data-attr="value"]'
        if (selector.includes('[data-toggle-type="details"]')) {
          if (
            node.classList.contains('chat-alert-toggle') &&
            node.dataset &&
            node.dataset.toggleType === 'details'
          ) {
            return node;
          }
        } else if (selector.includes('[data-toggle-type="message"]')) {
          if (
            node.classList.contains('chat-alert-toggle') &&
            node.dataset &&
            node.dataset.toggleType === 'message'
          ) {
            return node;
          }
        } else if (
          selector.startsWith('.') &&
          node.classList.contains(selector.substring(1))
        ) {
          return node;
        } else if (node.tagName === selector.toUpperCase()) {
          return node;
        }

        if (typeof node.querySelector === 'function') {
          const found = node.querySelector(selector);
          if (found) return found;
        }
      }
      return null;
    }),
    querySelectorAll: jest.fn(function (selector) {
      const results = [];
      const childNodes = this._childNodes || [];

      for (const node of childNodes) {
        if (!node.classList) continue;

        if (selector === 'button' && node.tagName === 'BUTTON') {
          results.push(node);
        } else if (
          selector.startsWith('.') &&
          node.classList.contains(selector.substring(1))
        ) {
          results.push(node);
        } else if (node.tagName === selector.toUpperCase()) {
          results.push(node);
        }

        // Recursively search child nodes
        if (typeof node.querySelectorAll === 'function') {
          const childResults = node.querySelectorAll(selector);
          for (let i = 0; i < childResults.length; i++) {
            results.push(childResults[i]);
          }
        }
      }
      return results;
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
        'core:display_warning',
        expect.any(Function)
      );
      expect(mocks.safeEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:display_error',
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

    it('should throw an error when safeEventDispatcher dependency is missing', () => {
      const invalidMocks = {
        logger: createMockLogger(),
        documentContext: createMockDocumentContext(),
        safeEventDispatcher: null,
        domElementFactory: createMockDomElementFactory(),
        alertRouter: createMockAlertRouter(),
      };

      expect(() => new ChatAlertRenderer(invalidMocks)).toThrow(
        /ValidatedEventDispatcher dependency is missing or invalid/
      );
    });

    it('should throw error when alertRouter dependency is missing', () => {
      const invalidMocks = {
        logger: createMockLogger(),
        documentContext: createMockDocumentContext(),
        safeEventDispatcher: createMockSafeEventDispatcher(),
        domElementFactory: createMockDomElementFactory(),
        alertRouter: null,
      };

      expect(() => new ChatAlertRenderer(invalidMocks)).toThrow(
        /AlertRouter dependency is required\./
      );
    });
  });

  describe('Throttling Logic', () => {
    it('should NOT render a warning bubble if warning throttler returns false', () => {
      mockWarningAllow.mockReturnValue(false);
      mocks.safeEventDispatcher.trigger('core:display_warning', {
        details: {},
      });
      expect(mockWarningAllow).toHaveBeenCalled();
      expect(mockErrorAllow).not.toHaveBeenCalled();
      expect(mocks.mockChatPanel.appendChild).not.toHaveBeenCalled();
    });

    it('should NOT render an error bubble if error throttler returns false', () => {
      mockErrorAllow.mockReturnValue(false);
      mocks.safeEventDispatcher.trigger('core:display_error', {
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
      mocks.safeEventDispatcher.trigger('core:display_warning', {
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
      localMocks.safeEventDispatcher.trigger('core:display_warning', {
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
      mocks.safeEventDispatcher.trigger('core:display_warning', {
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
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const msgEl = bubble.querySelector('.chat-alert-message');
      expect(msgEl.textContent).toBe(
        'Service temporarily unavailable. Please retry in a moment.'
      );
      const pre = bubble.querySelector('pre');
      const code = pre.querySelector('code');
      // **FIXED**: Assert against the new, multi-line developer details format.
      const expectedDetails = [
        'Status Code: 503',
        'URL: /api/x',
        'Details: 503 Service Unavailable',
      ].join('\n');
      expect(code.textContent).toBe(expectedDetails);
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
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      // **FIXED**: Assert against the new, multi-line format. The use of
      // `.textContent` in the implementation correctly prevents HTML parsing,
      // so the raw string is expected.
      const expectedDetails = [
        'Status Code: 500',
        'URL: /bad',
        'Details: <img src=x onerror=alert(1)>',
      ].join('\n');
      expect(code.textContent).toBe(expectedDetails);
    });
  });

  describe('Toggle functionality edge cases', () => {
    it('should ignore clicks on non-toggle elements', () => {
      const longMsg = 'x'.repeat(250);
      mocks.safeEventDispatcher.trigger('core:display_warning', {
        message: longMsg,
        details: {},
      });

      // Create a mock element that doesn't have the toggle class
      const nonToggleElement = createMockElement('span');
      nonToggleElement.closest = jest.fn(() => null);

      // Simulate click on non-toggle element
      mocks.mockChatPanel._eventListeners.click({ target: nonToggleElement });

      // Should not throw or cause issues
      expect(nonToggleElement.closest).toHaveBeenCalledWith(
        '.chat-alert-toggle'
      );
    });

    it('should handle message toggle when target element cannot be found', () => {
      const longMsg = 'x'.repeat(250);
      mocks.safeEventDispatcher.trigger('core:display_warning', {
        message: longMsg,
        details: {},
      });

      // Create a mock toggle button with invalid aria-controls
      const invalidToggleBtn = createMockElement('button');
      invalidToggleBtn.dataset.toggleType = 'message';
      invalidToggleBtn.setAttribute('aria-controls', 'non-existent-id');
      invalidToggleBtn.closest = jest.fn(() => invalidToggleBtn);

      // Mock the documentContext to return null for the invalid ID
      mocks.documentContext.query.mockReturnValueOnce(null);

      // Simulate click on invalid toggle button
      mocks.mockChatPanel._eventListeners.click({ target: invalidToggleBtn });

      // Should log warning about not finding the element
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find message element for toggle button'
        )
      );
    });

    it('should toggle message text from collapsed to expanded state', () => {
      const longMsg = 'x'.repeat(250);
      mocks.safeEventDispatcher.trigger('core:display_warning', {
        message: longMsg,
        details: {},
      });

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const msgEl = bubble.querySelector('.chat-alert-message');
      const toggleBtn = bubble.querySelector('.chat-alert-toggle');
      toggleBtn.dataset.toggleType = 'message';

      // Verify initial collapsed state
      expect(msgEl.textContent.length).toBe(201); // 200 chars + ellipsis
      expect(toggleBtn.textContent).toBe('Show more');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

      // Click to expand
      mocks.mockChatPanel._eventListeners.click({ target: toggleBtn });

      // Verify expanded state
      expect(msgEl.textContent).toBe(longMsg);
      expect(toggleBtn.textContent).toBe('Show less');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

      // Click to collapse again
      mocks.mockChatPanel._eventListeners.click({ target: toggleBtn });

      // Verify collapsed state again
      expect(msgEl.textContent.length).toBe(201);
      expect(toggleBtn.textContent).toBe('Show more');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should handle details toggle when target element cannot be found', () => {
      const payload = {
        message: 'Error message',
        details: { statusCode: 500, url: '/api/test' },
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      // Create a mock toggle button with invalid aria-controls
      const invalidToggleBtn = createMockElement('button');
      invalidToggleBtn.dataset.toggleType = 'details';
      invalidToggleBtn.setAttribute('aria-controls', 'non-existent-details-id');
      invalidToggleBtn.closest = jest.fn(() => invalidToggleBtn);

      // Mock the documentContext to return null for the invalid ID
      mocks.documentContext.query.mockReturnValueOnce(null);

      // Simulate click on invalid details toggle button
      mocks.mockChatPanel._eventListeners.click({ target: invalidToggleBtn });

      // Should log warning about not finding the details content
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find details content for toggle button'
        )
      );
    });

    it('should toggle developer details visibility state', () => {
      const payload = {
        message: 'Server error with details',
        details: { statusCode: 500, url: '/api/test', raw: 'Internal issue' },
      };

      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const detailsContainer = bubble.querySelector('.chat-alert-details');
      const toggleBtn = detailsContainer.querySelector('.chat-alert-toggle');
      const pre = detailsContainer.querySelector('.chat-alert-details-content');

      toggleBtn.dataset.toggleType = 'details';

      expect(pre.hidden).toBe(true);
      expect(String(toggleBtn.getAttribute('aria-expanded'))).toBe('false');

      mocks.mockChatPanel._eventListeners.click({ target: toggleBtn });

      expect(pre.hidden).toBe(false);
      expect(String(toggleBtn.getAttribute('aria-expanded'))).toBe('true');

      mocks.mockChatPanel._eventListeners.click({ target: toggleBtn });

      expect(pre.hidden).toBe(true);
      expect(String(toggleBtn.getAttribute('aria-expanded'))).toBe('false');
    });

    it('should handle unknown toggle type gracefully', () => {
      const longMsg = 'x'.repeat(250);
      mocks.safeEventDispatcher.trigger('core:display_warning', {
        message: longMsg,
        details: {},
      });

      // Create a mock toggle button with unknown type
      const unknownToggleBtn = createMockElement('button');
      unknownToggleBtn.dataset.toggleType = 'unknown-type';
      unknownToggleBtn.closest = jest.fn(() => unknownToggleBtn);

      // This should not throw an error and should do nothing
      mocks.mockChatPanel._eventListeners.click({ target: unknownToggleBtn });

      // No error should occur - the method should handle unknown types gracefully
      expect(unknownToggleBtn.closest).toHaveBeenCalledWith(
        '.chat-alert-toggle'
      );
    });
  });

  describe('Developer details extraction edge cases', () => {
    it('should extract stack trace from Error objects', () => {
      const error = new Error('Test error message');
      error.stack =
        'Error: Test error message\n    at Function.test\n    at main.js:10:5';

      const payload = {
        message: 'An error occurred',
        details: error,
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe(error.stack);
    });

    it('should handle status code objects with missing optional properties', () => {
      const payload = {
        message: 'Server error',
        details: { statusCode: 404 }, // No url or raw properties
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe('Status Code: 404');
    });

    it('should handle status code objects with stack trace', () => {
      const payload = {
        message: 'Server error with stack',
        details: {
          statusCode: 500,
          url: '/api/endpoint',
          raw: 'Internal server error',
          stack: 'Error: Something went wrong\n    at handler.js:25:10',
        },
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      const expectedDetails = [
        'Status Code: 500',
        'URL: /api/endpoint',
        'Details: Internal server error',
        '',
        'Stack Trace:',
        'Error: Something went wrong\n    at handler.js:25:10',
      ].join('\n');
      expect(code.textContent).toBe(expectedDetails);
    });

    it('should handle string details', () => {
      const payload = {
        message: 'Simple error',
        details: 'This is a string detail',
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe('This is a string detail');
    });

    it('should handle number details', () => {
      const payload = {
        message: 'Numeric error',
        details: 12345,
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe('12345');
    });

    it('should serialize non-empty objects to JSON', () => {
      const payload = {
        message: 'Object error',
        details: { customProperty: 'value', anotherProperty: 123 },
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      const expectedJson = JSON.stringify(payload.details, null, 2);
      expect(code.textContent).toBe(expectedJson);
    });

    it('should handle JSON serialization errors gracefully', () => {
      // Create a circular reference that will cause JSON.stringify to fail
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      const payload = {
        message: 'Circular reference error',
        details: circularObj,
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      const code = bubble.querySelector('code');
      expect(code.textContent).toBe('Could not serialize details object.');
    });

    it('should handle empty objects and return null', () => {
      const payload = {
        message: 'Error with empty object',
        details: {},
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload);

      const bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      // Should not have developer details section since empty object returns null
      const detailsContainer = bubble.querySelector('.chat-alert-details');
      expect(detailsContainer).toBeNull();
    });

    it('should handle null and undefined details', () => {
      const payload1 = {
        message: 'Error with null details',
        details: null,
      };
      mocks.safeEventDispatcher.trigger('core:display_error', payload1);

      let bubble = mocks.mockChatPanel.appendChild.mock.calls[0][0];
      let detailsContainer = bubble.querySelector('.chat-alert-details');
      expect(detailsContainer).toBeNull();

      // Clear the mock and test undefined
      jest.clearAllMocks();
      const { mocks: freshMocks } = setup();

      const payload2 = {
        message: 'Error with undefined details',
        details: undefined,
      };
      freshMocks.safeEventDispatcher.trigger('core:display_error', payload2);

      bubble = freshMocks.mockChatPanel.appendChild.mock.calls[0][0];
      detailsContainer = bubble.querySelector('.chat-alert-details');
      expect(detailsContainer).toBeNull();
    });
  });

  describe('Panel absence error logging', () => {
    it('should log error to console when panel is not present for errors', () => {
      const { mocks: localMocks } = setup(false);
      mockErrorAllow.mockReturnValue(true);

      const message = 'Console error message';
      const details = 'Additional error details';
      localMocks.safeEventDispatcher.trigger('core:display_error', {
        message,
        details,
      });

      expect(localMocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`[UI ERROR] ${message} | Details: ${details}`)
      );
    });
  });
});
