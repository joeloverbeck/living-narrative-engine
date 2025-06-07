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
import { ChatAlertRenderer } from '../../src/domUI/index.js';

// Real implementation needed for creating elements within the test
import DomElementFactory from '../../src/domUI/domElementFactory.js';

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

// This mock is no longer used by the renderer but we keep its definition here
// to avoid having to remove it from the constructor call. It has no effect.
const mockAlertMessageFormatter = {
  format: jest.fn(),
};

describe('ChatAlertRenderer Throttling Integration', () => {
  let renderer;
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
    renderer = new ChatAlertRenderer({
      logger: mockLogger,
      documentContext: testDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      domElementFactory: new DomElementFactory(testDocumentContext),
      alertRouter: mockAlertRouter,
      alertMessageFormatter: mockAlertMessageFormatter, // No longer used, but constructor expects it
    });
  });

  afterEach(() => {
    // Restore real timers and clear all mocks between tests
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  /**
   * Helper to simulate an external event dispatch, triggering the renderer's subscribed handler.
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
        message: 'Original event message, should be ignored.', // Ignored due to statusCode
        details: { statusCode: 408, url: '/api/data' },
      };
      // **FIX**: The expected message now comes from statusCodeMapper, not a mock.
      // 408 is an unmapped code.
      const expectedDisplayMessage = 'An unexpected error occurred.';

      // --- Act: Dispatch three identical events in quick succession ---
      fireEvent('ui:display_warning', warningPayload);
      fireEvent('ui:display_warning', warningPayload);
      fireEvent('ui:display_warning', warningPayload);

      // --- Assert: Immediate State (Test Case 1: Identical Warnings Suppression) ---
      expect(chatPanel.children.length).toBe(1);
      const firstBubble = chatPanel.children[0];
      expect(firstBubble.classList.contains('chat-warning-bubble')).toBe(true);
      expect(firstBubble.textContent).toContain('Warning');
      // **FIX**: Assert against the message from the status code mapper.
      expect(firstBubble.textContent).toContain(expectedDisplayMessage);
      expect(firstBubble.textContent).toContain('408 at /api/data');

      // The throttler should not have dispatched a summary event yet.
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();

      // --- Act: Advance time by 10 seconds to close the throttling window ---
      jest.advanceTimersByTime(10000);

      // --- Assert: Final State (Test Case 2: Identical Warnings Coalescing) ---
      // The throttler's timeout should have fired, dispatching a summary event.
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);

      // **FIX**: The expected summary message must be based on the actual display message.
      const expectedSummaryPayload = {
        message: `Warning: '${expectedDisplayMessage}' occurred 2 more times in the last 10 seconds.`,
        details: warningPayload.details, // Details are carried over.
      };
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'ui:display_warning',
        expectedSummaryPayload
      );

      // A second bubble (the summary) should now be rendered in the DOM.
      expect(chatPanel.children.length).toBe(2);
      const summaryBubble = chatPanel.children[1];
      expect(summaryBubble.classList.contains('chat-warning-bubble')).toBe(
        true
      );
    });
  });

  describe('Test Case 3: Separate Throttling for Errors and Warnings', () => {
    it('should render two separate bubbles for a warning and an error with the same content', () => {
      // --- Arrange ---
      const payload = {
        message: 'This message is overridden by the status code.',
        details: { statusCode: 500, url: '/api/critical' },
      };
      // **FIX**: The expected message comes from the mapped status code 500.
      const expectedDisplayMessage = 'Server error. Please try again later.';

      // --- Act ---
      fireEvent('ui:display_warning', payload);
      fireEvent('ui:display_error', payload);

      // --- Assert ---
      // Both should be rendered immediately as they use separate throttler instances.
      expect(chatPanel.children.length).toBe(2);
      const bubble1 = chatPanel.children[0];
      const bubble2 = chatPanel.children[1];

      // Check that one is a warning and one is an error.
      const bubble1IsWarning = bubble1.classList.contains(
        'chat-warning-bubble'
      );
      const bubble2IsError = bubble2.classList.contains('chat-error-bubble');
      expect(bubble1IsWarning).toBe(true);
      expect(bubble2IsError).toBe(true);

      // **FIX**: Verify the mapped content is present in both.
      expect(bubble1.textContent).toContain(expectedDisplayMessage);
      expect(bubble2.textContent).toContain(expectedDisplayMessage);

      // Advance time and assert that no summary is generated for either.
      jest.advanceTimersByTime(10000);
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
      expect(chatPanel.children.length).toBe(2);
    });
  });

  describe('Test Case 4: Retry Aggregation Compliance', () => {
    it('should render a single error bubble and NOT a summary for a one-off event', () => {
      // --- Arrange ---
      const finalErrorPayload = {
        message: 'This original message will be ignored.',
        details: { statusCode: 504, url: '/api/flaky-service' },
      };
      // **FIX**: The expected message is for an unmapped status code.
      const expectedDisplayMessage = 'An unexpected error occurred.';

      // --- Act: Dispatch a single, final error event ---
      fireEvent('ui:display_error', finalErrorPayload);

      // --- Assert: Immediate State ---
      // One error bubble should appear.
      expect(chatPanel.children.length).toBe(1);
      const errorBubble = chatPanel.children[0];
      expect(errorBubble.classList.contains('chat-error-bubble')).toBe(true);
      // **FIX**: Assert against the message from the status code mapper.
      expect(errorBubble.textContent).toContain(expectedDisplayMessage);
      expect(errorBubble.textContent).toContain('504 at /api/flaky-service');

      // --- Act: Advance time past the throttle window ---
      jest.advanceTimersByTime(10000);

      // --- Assert: Final State ---
      // The throttler's timer will fire, but since suppressedCount is 0, it must NOT dispatch an event.
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
      // Therefore, the number of DOM elements must remain 1.
      expect(chatPanel.children.length).toBe(1);
    });
  });
});
