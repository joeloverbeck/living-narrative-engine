/**
 * @file Unit tests for the ActionResultRenderer class.
 * @see Ticket 2.1.4
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
import { ActionResultRenderer } from '../../src/domUI/actionResultRenderer.js';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockDomElementFactory = {
  li: jest.fn(),
};

// This will store the event listeners subscribed by the renderer
let eventListeners;

const mockValidatedEventDispatcher = {
  subscribe: jest.fn((eventName, listener) => {
    eventListeners[eventName] = listener;
    // Return a mock unsubscribe function
    return () => {
      delete eventListeners[eventName];
    };
  }),
  dispatch: jest.fn(), // Not used by the class under test, but part of the interface
};

let mockMessageList;
let mockScrollContainer;
let mockDocumentContext;

describe('ActionResultRenderer', () => {
  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
    eventListeners = {};

    // Mock the DOM environment
    mockMessageList = {
      appendChild: jest.fn(),
      // These properties are part of the element's interface but not directly used for scrolling logic under test
      scrollTop: 0,
      scrollHeight: 100,
    };
    mockScrollContainer = {
      scrollTop: 0,
      scrollHeight: 250, // Mock value
    };
    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === '#message-list') {
          return mockMessageList;
        }
        if (selector === '#outputDiv') {
          return mockScrollContainer;
        }
        return null;
      }),
      create: jest.fn(), // Not directly used by ActionResultRenderer, but part of the interface
    };

    // Instantiate the class under test with all mock dependencies
    new ActionResultRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
    });
  });

  afterEach(() => {
    // Clean up
    eventListeners = null;
    mockMessageList = null;
    mockScrollContainer = null;
    mockDocumentContext = null;
  });

  describe('Test Case: Initialization', () => {
    it('should instantiate without errors and bind to the message list', () => {
      // The constructor is called in beforeEach. If it throws, the test fails.
      // We can assert that the necessary DOM queries were made.
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#message-list');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#outputDiv');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should subscribe to success and failure events on construction', () => {
      // Assert that _addSubscription is called twice with the correct event names
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(2);
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:display_successful_action_result',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:display_failed_action_result',
        expect.any(Function)
      );
    });
  });

  describe('Test Case: Success Event Handling', () => {
    it('should create and append a success bubble on a success event', () => {
      // Arrange
      const mockLiElement = { textContent: '' };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      const successPayload = { message: 'You successfully picked the lock!' };

      // Act
      // Simulate the dispatch of a core:display_successful_action_result event.
      const handler = eventListeners['core:display_successful_action_result'];
      handler({ payload: successPayload });

      // Assert
      // Verify that the #handleSuccess method is called (by its effects).
      // Assert that a new <li> element is created with the action-success-bubble class.
      expect(mockDomElementFactory.li).toHaveBeenCalledWith(
        'action-success-bubble'
      );
      expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

      // Assert that the <li>'s textContent matches the event payload's message.
      expect(mockLiElement.textContent).toBe(successPayload.message);

      // Assert that the <li> is appended to the mock #message-list container.
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
      expect(mockMessageList.appendChild).toHaveBeenCalledTimes(1);

      // Assert that the container is scrolled to the bottom
      expect(mockScrollContainer.scrollTop).toBe(
        mockScrollContainer.scrollHeight
      );
    });
  });

  describe('Test Case: Failure Event Handling', () => {
    it('should create and append a failure bubble on a failure event', () => {
      // Arrange
      const mockLiElement = { textContent: '' };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      const failurePayload = { message: 'Your lockpick broke.' };

      // Act
      // Simulate the dispatch of a core:display_failed_action_result event.
      const handler = eventListeners['core:display_failed_action_result'];
      handler({ payload: failurePayload });

      // Assert
      // Verify that the #handleFailure method is called (by its effects).
      // Assert that a new <li> element is created with the action-failure-bubble class.
      expect(mockDomElementFactory.li).toHaveBeenCalledWith(
        'action-failure-bubble'
      );
      expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

      // Assert that the <li>'s textContent matches the event payload's message.
      expect(mockLiElement.textContent).toBe(failurePayload.message);

      // Assert that the <li> is appended to the mock #message-list container.
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
      expect(mockMessageList.appendChild).toHaveBeenCalledTimes(1);

      // Assert that the container is scrolled to the bottom
      expect(mockScrollContainer.scrollTop).toBe(
        mockScrollContainer.scrollHeight
      );
    });
  });

  describe('Test Case: Ignoring Other Events', () => {
    it('should not subscribe to irrelevant events', () => {
      // This test re-checks the calls to `subscribe` to ensure no unexpected subscriptions were made.
      const subscribedEventNames =
        mockValidatedEventDispatcher.subscribe.mock.calls.map(
          (call) => call[0]
        );
      expect(subscribedEventNames).not.toContain('core:display_message');
      expect(subscribedEventNames).not.toContain('some:other_event');
    });
  });

  describe('Test Case: Malformed Payloads', () => {
    it('should log a warning and not render a bubble for a payload with a null message', () => {
      // Arrange
      const malformedPayload = { message: null };

      // Act
      const handler = eventListeners['core:display_successful_action_result'];
      handler({ payload: malformedPayload });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received invalid or empty message. Aborting bubble render.'
        ),
        { message: null }
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('should log a warning and not render a bubble for a payload with an empty string message', () => {
      // Arrange
      const malformedPayload = { message: '  ' }; // whitespace

      // Act
      const handler = eventListeners['core:display_failed_action_result'];
      handler({ payload: malformedPayload });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received invalid or empty message. Aborting bubble render.'
        ),
        { message: '  ' }
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('should not throw an error and not render a bubble for a completely empty payload', () => {
      // Arrange
      const emptyPayload = {};

      // Act
      const handler = eventListeners['core:display_successful_action_result'];
      const action = () => handler({ payload: emptyPayload });

      // Assert
      expect(action).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received invalid or empty message. Aborting bubble render.'
        ),
        { message: undefined }
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });
  });
});
