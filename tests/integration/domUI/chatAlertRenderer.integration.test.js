/**
 * @file Integration tests for ChatAlertRenderer, focusing on throttling and alert coalescing.
 * @see Jira ID: FE-105
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// Class under test
import { ChatAlertRenderer } from '../../../src/domUI';

import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

// Real implementation needed for creating elements within the test
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
  DISPLAY_WARNING_ID,
} from '../../../src/constants/eventIds.js';

// Mock all dependencies to isolate the ChatAlertRenderer component
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockAlertRouter = {
  notifyUIReady: jest.fn(),
};

describe('ChatAlertRenderer Throttling Integration', () => {
  let chatPanel;
  let mockSafeEventDispatcher;
  let testDocumentContext;

  beforeEach(() => {
    // AC: Use fake timers to control the 10-second throttling window.
    jest.useFakeTimers();

    // Set up the JSDOM environment
    document.body.innerHTML = '<div id="message-list"></div>';
    chatPanel = document.getElementById('message-list');

    // AC: Use a mock ValidatedEventDispatcher.
    // This mock simulates the event bus for subscribing and dispatching.
    const listeners = new Map();
    mockSafeEventDispatcher = {
      // The `dispatch` method is a spy to track events sent by the Throttler.
      // It also forwards the event back to the appropriate listener to simulate the bus.
      dispatch: jest.fn((eventName, payload) => {
        if (listeners.has(eventName)) {
          listeners.get(eventName)({ payload });
        }
      }),
      subscribe: jest.fn((eventName, callback) => {
        listeners.set(eventName, callback);
        return () => listeners.delete(eventName); // Return unsubscribe function
      }),
      unsubscribe: jest.fn(),
    };

    // Wrap JSDOM's document in the expected context object interface
    testDocumentContext = {
      query: (selector) => document.querySelector(selector),
      create: (tag) => document.createElement(tag),
    };

    // Instantiate the renderer with all its mocked dependencies
    new ChatAlertRenderer({
      logger: mockLogger,
      documentContext: testDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      domElementFactory: new DomElementFactory(testDocumentContext),
      alertRouter: mockAlertRouter,
    });
  });

  afterEach(() => {
    // Restore real timers and clear all mocks between tests
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  /**
   * Helper to simulate an external event dispatch, triggering the renderer's subscribed handler.
   *
   * @param {string} eventName The name of the event to fire.
   * @param {object} payload The event payload.
   */
  const fireEvent = (eventName, payload) => {
    const subscribeCall = mockSafeEventDispatcher.subscribe.mock.calls.find(
      (call) => call[0] === eventName
    );
    if (!subscribeCall) {
      throw new Error(
        `Test Error: No subscriber found for event "${eventName}".`
      );
    }
    const handler = subscribeCall[1];
    // Renderer handlers expect an event object with a `payload` property.
    handler({ payload });
  };

  describe('Test Case 1 & 2: Identical Warnings Suppression and Coalescing', () => {
    it('should suppress identical warnings and render a summary bubble after 10s', () => {
      // --- Arrange ---
      const warningPayload = {
        message: 'Connection timed out.',
        details: { statusCode: 408, url: '/api/data' },
      };

      // --- Act: Dispatch three identical events in quick succession ---
      fireEvent('core:display_warning', warningPayload);
      fireEvent('core:display_warning', warningPayload);
      fireEvent('core:display_warning', warningPayload);

      // --- Assert: Immediate State (Test Case 1: Identical Warnings Suppression) ---
      expect(chatPanel.children.length).toBe(1);
      const firstBubble = chatPanel.children[0];
      // FIXED: Assert against the correct camelCase class name.
      expect(firstBubble.classList.contains('chat-warningBubble')).toBe(true);
      expect(firstBubble.textContent).toContain('Warning');
      expect(firstBubble.textContent).toContain('Connection timed out.');

      // The throttler should not have dispatched a summary event yet.
      expectNoDispatch(mockSafeEventDispatcher.dispatch);

      // --- Act: Advance time by 10 seconds to close the throttling window ---
      jest.advanceTimersByTime(10000);

      // --- Assert: Final State (Test Case 2: Identical Warnings Coalescing) ---
      // The throttler's timeout should have fired, dispatching a summary event.
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);

      // **FIX**: The expected message must match the actual output from the Throttler.
      const expectedSummaryPayload = {
        message:
          "Warning: 'Connection timed out.' occurred 2 more times in the last 10 seconds.",
        details: warningPayload.details, // Details are carried over.
      };
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:display_warning',
        expectedSummaryPayload
      );

      // A second bubble (the summary) should now be rendered in the DOM.
      expect(chatPanel.children.length).toBe(2);
      const summaryBubble = chatPanel.children[1];
      // FIXED: Assert against the correct camelCase class name.
      expect(summaryBubble.classList.contains('chat-warningBubble')).toBe(true);
    });
  });

  describe('Test Case 3: Separate Throttling for Errors and Warnings', () => {
    it('should render two separate bubbles for a warning and an error with the same content', () => {
      // --- Arrange ---
      const payload = {
        message: 'Same message content.',
        details: { statusCode: 500, url: '/api/critical' },
      };

      // --- Act ---
      fireEvent('core:display_warning', payload);
      fireEvent('core:display_error', payload);

      // --- Assert ---
      // Both should be rendered immediately as they use separate throttler instances.
      expect(chatPanel.children.length).toBe(2);
      const bubble1 = chatPanel.children[0];
      const bubble2 = chatPanel.children[1];

      // Check that one is a warning and one is an error.
      // FIXED: Assert against the correct camelCase class names.
      const bubble1IsWarning = bubble1.classList.contains('chat-warningBubble');
      const bubble2IsError = bubble2.classList.contains('chat-errorBubble');
      expect(bubble1IsWarning).toBe(true);
      expect(bubble2IsError).toBe(true);

      // Verify the content is present in both.
      expect(bubble1.textContent).toContain('Same message content.');
      expect(bubble2.textContent).toContain('Same message content.');

      // Advance time and assert that no summary is generated for either.
      jest.advanceTimersByTime(10000);
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
      expect(chatPanel.children.length).toBe(2);
    });
  });

  describe('Test Case 4: Retry Aggregation Compliance', () => {
    it('should render a single error bubble and NOT a summary for a one-off event', () => {
      // --- Arrange ---
      const finalErrorPayload = {
        message: 'Final attempt failed after 3 retries.',
        details: { statusCode: 504, url: '/api/flaky-service' },
      };

      // --- Act: Dispatch a single, final error event ---
      fireEvent('core:display_error', finalErrorPayload);

      // --- Assert: Immediate State ---
      // One error bubble should appear.
      expect(chatPanel.children.length).toBe(1);
      const errorBubble = chatPanel.children[0];
      // FIXED: Assert against the correct camelCase class name.
      expect(errorBubble.classList.contains('chat-errorBubble')).toBe(true);
      expect(errorBubble.textContent).toContain(
        'Final attempt failed after 3 retries.'
      );

      // --- Act: Advance time past the throttle window ---
      jest.advanceTimersByTime(10000);

      // --- Assert: Final State ---
      // The throttler's timer will fire, but since suppressedCount is 0, it must NOT dispatch an event.
      expectNoDispatch(mockSafeEventDispatcher.dispatch);
      // Therefore, the number of DOM elements must remain 1.
      expect(chatPanel.children.length).toBe(1);
    });
  });
});

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class SimpleValidatedDispatcher {
  constructor(eventBus, logger) {
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async dispatch(eventName, payload) {
    try {
      await this.eventBus.dispatch(eventName, payload);
      return true;
    } catch (error) {
      this.logger.error('simple dispatcher dispatch error', {
        eventName,
        error,
      });
      return false;
    }
  }

  subscribe(eventName, listener) {
    return this.eventBus.subscribe(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    return this.eventBus.unsubscribe(eventName, listener);
  }
}

describe('ChatAlertRenderer end-to-end integration', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {SafeEventDispatcher} */
  let safeEventDispatcher;
  /** @type {AlertRouter} */
  let alertRouter;
  /** @type {DocumentContext} */
  let documentContext;
  /** @type {DomElementFactory} */
  let domElementFactory;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="outputDiv">
        <ul id="message-list"></ul>
      </div>
    `;

    logger = new RecordingLogger();
    const busLogger = new RecordingLogger();
    const eventBus = new EventBus({ logger: busLogger });
    const validatedDispatcher = new SimpleValidatedDispatcher(eventBus, logger);

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    alertRouter = new AlertRouter({ safeEventDispatcher });
    documentContext = new DocumentContext(document, logger);
    domElementFactory = new DomElementFactory(documentContext);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createRenderer = () =>
    new ChatAlertRenderer({
      logger,
      documentContext,
      safeEventDispatcher,
      domElementFactory,
      alertRouter,
    });

  it('renders warning alerts with truncation, toggles, and developer details using real services', async () => {
    createRenderer();

    expect(alertRouter.uiReady).toBe(true);

    const longMessage = 'A'.repeat(250);
    const warningDetails = {
      statusCode: 503,
      url: '/api/status',
      raw: { message: 'Service unavailable' },
    };

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: longMessage,
      details: warningDetails,
    });

    const panel = document.getElementById('message-list');
    expect(panel.children.length).toBe(1);
    const bubble = panel.firstElementChild;
    expect(bubble.classList.contains('chat-warningBubble')).toBe(true);

    const messageElement = bubble.querySelector('.chat-alert-message');
    expect(messageElement.textContent.endsWith('…')).toBe(true);

    const messageToggle = bubble.querySelector('[data-toggle-type="message"]');
    messageToggle.click();
    expect(messageElement.textContent).toBe(longMessage);
    expect(messageToggle.getAttribute('aria-expanded')).toBe('true');

    const detailsToggle = bubble.querySelector('[data-toggle-type="details"]');
    detailsToggle.click();
    const detailsContent = bubble.querySelector('.chat-alert-details-content');
    expect(detailsContent.hidden).toBe(false);
    const detailsText = detailsContent.textContent;
    expect(detailsText).toContain('Status Code: 503');
    expect(detailsText).toContain('URL: /api/status');
    expect(detailsText).toContain('Service unavailable');

    messageToggle.click();
    expect(messageElement.textContent.endsWith('…')).toBe(true);
  });

  it('falls back to status-code friendly messaging when the payload omits message text', async () => {
    createRenderer();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: '',
      details: { statusCode: 404, url: '/missing/resource' },
    });

    const panel = document.getElementById('message-list');
    expect(panel.children.length).toBe(1);
    const bubble = panel.firstElementChild;
    const messageElement = bubble.querySelector('.chat-alert-message');
    expect(messageElement.textContent).toBe('Resource not found.');
  });

  it('coalesces repeated warnings into a summary bubble after the throttle window', async () => {
    createRenderer();

    const payload = {
      message: 'Cache failure detected.',
      details: { statusCode: 500 },
    };

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, payload);
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, payload);
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, payload);

    const panel = document.getElementById('message-list');
    expect(panel.children.length).toBe(1);

    jest.advanceTimersByTime(10000);
    await Promise.resolve();
    await Promise.resolve();

    expect(panel.children.length).toBe(2);
    const summaryBubble = panel.lastElementChild;
    expect(summaryBubble.textContent).toContain(
      "Warning: 'Cache failure detected.' occurred 2 more times in the last 10 seconds."
    );
  });

  it('formats developer details for error objects and renders error styling', async () => {
    createRenderer();

    const catastrophicError = new Error('Catastrophic failure');

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'System meltdown imminent.',
      details: catastrophicError,
    });

    const panel = document.getElementById('message-list');
    expect(panel.children.length).toBe(1);
    const bubble = panel.firstElementChild;
    expect(bubble.classList.contains('chat-errorBubble')).toBe(true);

    const detailsToggle = bubble.querySelector('[data-toggle-type="details"]');
    detailsToggle.click();
    const detailsContent = bubble.querySelector('.chat-alert-details-content');
    expect(detailsContent.hidden).toBe(false);
    const codeElement = detailsContent.querySelector('code');
    expect(codeElement.textContent).toContain('Error: Catastrophic failure');
  });

  it('logs alerts when the chat panel is absent instead of rendering DOM nodes', async () => {
    document.body.innerHTML = '<div id="outputDiv"></div>';

    logger = new RecordingLogger();
    const busLogger = new RecordingLogger();
    const eventBus = new EventBus({ logger: busLogger });
    const validatedDispatcher = new SimpleValidatedDispatcher(eventBus, logger);
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    alertRouter = new AlertRouter({ safeEventDispatcher });
    documentContext = new DocumentContext(document, logger);
    domElementFactory = new DomElementFactory(documentContext);

    createRenderer();

    expect(alertRouter.uiReady).toBe(false);

    await safeEventDispatcher.dispatch(DISPLAY_WARNING_ID, {
      message: 'Heads up!',
      details: { raw: 'trace info' },
    });

    expect(document.querySelector('.chat-alert')).toBeNull();
    const warningLog = logger.warnLogs.find((entry) =>
      entry[0]?.includes('[UI WARNING] Heads up!')
    );
    expect(warningLog).toBeDefined();
  });
});
