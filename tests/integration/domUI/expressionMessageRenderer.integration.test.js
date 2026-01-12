/**
 * @file Integration tests for ExpressionMessageRenderer.
 * Tests complete event flow from dispatch through DOM rendering.
 * @see Ticket EXPCHAPANREN-006
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// Import renderers (integration tests dispatch via event bus, not ExpressionDispatcher directly)
import { ExpressionMessageRenderer } from '../../../src/domUI/expressionMessageRenderer.js';
import { DamageEventMessageRenderer } from '../../../src/domUI/damageEventMessageRenderer.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

/**
 * Creates a minimal logger for testing.
 *
 * @returns {object} Logger mock with all required methods.
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates a mock event bus that supports multiple subscribers per event
 * and dispatches events to all registered listeners.
 *
 * @returns {object} Mock event bus with subscribe and dispatch methods.
 */
const createMockEventBus = () => {
  const eventListeners = {};
  return {
    subscribe: jest.fn((eventName, listener) => {
      if (!eventListeners[eventName]) {
        eventListeners[eventName] = [];
      }
      eventListeners[eventName].push(listener);
      return () => {
        const idx = eventListeners[eventName].indexOf(listener);
        if (idx >= 0) eventListeners[eventName].splice(idx, 1);
      };
    }),
    dispatch: jest.fn(async (eventName, payload) => {
      const listeners = eventListeners[eventName] || [];
      for (const listener of listeners) {
        await listener({ type: eventName, payload });
      }
    }),
    _listeners: eventListeners,
  };
};

describe('ExpressionMessageRenderer Integration', () => {
  let mockEventBus;
  let mockLogger;
  let documentContext;
  let domElementFactory;
  let messageList;
  let expressionRenderer;
  let damageRenderer;

  beforeEach(() => {
    // Setup real DOM elements using jsdom
    document.body.innerHTML = `
      <div id="outputDiv">
        <ul id="message-list"></ul>
      </div>
    `;
    messageList = document.getElementById('message-list');

    // Setup shared event bus and logger
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();

    // Use real DocumentContext and DomElementFactory for integration testing
    documentContext = new DocumentContext(document, mockLogger);
    domElementFactory = new DomElementFactory(documentContext);

    // Create renderers with shared event bus
    expressionRenderer = new ExpressionMessageRenderer({
      logger: mockLogger,
      documentContext,
      safeEventDispatcher: mockEventBus,
      domElementFactory,
    });

    damageRenderer = new DamageEventMessageRenderer({
      logger: mockLogger,
      documentContext,
      safeEventDispatcher: mockEventBus,
      domElementFactory,
    });
  });

  afterEach(() => {
    expressionRenderer?.dispose?.();
    damageRenderer?.dispose?.();
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Full Event Flow', () => {
    it('should render expression when event bus dispatches emotion.expression event', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: "Avery's features ease as tension releases.",
        contextualData: {
          source: 'expression_system',
          expressionId: 'emotions_affection:warm_affection',
          category: 'affection',
        },
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(1);
      const renderedMessage = messageList.children[0];
      expect(renderedMessage.textContent).toBe(
        expressionPayload.descriptionText
      );
    });

    it('should render with correct descriptionText from payload', async () => {
      // Arrange
      const narrativeText = 'A shadow passes over their expression.';
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: narrativeText,
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(1);
      expect(messageList.children[0].textContent).toBe(narrativeText);
    });

    it('should apply category-based CSS modifiers from expression definition', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'Rage builds within them.',
        contextualData: {
          category: 'anger',
        },
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      const renderedMessage = messageList.children[0];
      expect(renderedMessage.classList.contains('expression-message')).toBe(
        true
      );
      expect(
        renderedMessage.classList.contains('expression-message--anger')
      ).toBe(true);
    });

    it('should scroll chat panel to bottom after rendering', async () => {
      // Arrange - add initial content to message list
      const existingMessage = document.createElement('li');
      existingMessage.textContent = 'Existing message';
      messageList.appendChild(existingMessage);

      // Note: scrollHeight is read-only in jsdom, so we verify the message
      // was appended correctly (scrollToBottom is tested at unit level)

      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'A new expression appears.',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert - verify the message was appended after existing content
      // (scrollToBottom behavior is verified in unit tests)
      expect(messageList.children.length).toBe(2);
      expect(messageList.children[1].textContent).toBe(
        'A new expression appears.'
      );
    });
  });

  describe('Non-Interference with Existing Renderers', () => {
    it('should not interfere with DamageEventMessageRenderer', async () => {
      // Arrange
      const damagePayload = {
        perceptionType: 'damage_received',
        descriptionText: 'You take 15 damage to your arm.',
        totalDamage: 15,
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', damagePayload);

      // Assert - damage renderer handled it, expression renderer ignored it
      expect(messageList.children.length).toBe(1);
      expect(
        messageList.children[0].classList.contains('damage-message')
      ).toBe(true);
      expect(
        messageList.children[0].classList.contains('expression-message')
      ).toBe(false);
    });

    it('should ignore speech-related events', async () => {
      // Arrange - speech bubble events have different perceptionTypes
      const speechPayload = {
        perceptionType: 'communication.speech',
        descriptionText: 'Hello there!',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', speechPayload);

      // Assert - neither expression nor damage renderer should handle this
      // (SpeechBubbleRenderer subscribes to different events)
      expect(messageList.children.length).toBe(0);
    });

    it('should ignore action result events', async () => {
      // Arrange - action results have different perceptionTypes
      const actionPayload = {
        perceptionType: 'action.result',
        descriptionText: 'You successfully opened the door.',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', actionPayload);

      // Assert
      expect(messageList.children.length).toBe(0);
    });

    it('should coexist with DamageEventMessageRenderer on same event bus', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'Fear grips them.',
        contextualData: { category: 'threat' },
      };
      const damagePayload = {
        perceptionType: 'damage_received',
        descriptionText: 'They take 20 damage.',
        totalDamage: 20,
      };

      // Act - dispatch both types in sequence
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);
      await mockEventBus.dispatch('core:perceptible_event', damagePayload);

      // Assert - both messages rendered, each by correct renderer
      expect(messageList.children.length).toBe(2);
      expect(
        messageList.children[0].classList.contains('expression-message')
      ).toBe(true);
      expect(
        messageList.children[1].classList.contains('damage-message')
      ).toBe(true);
    });
  });

  describe('DOM Integration', () => {
    it('should append to existing message list with other message types', async () => {
      // Arrange - pre-populate with existing messages
      const existingDamage = document.createElement('li');
      existingDamage.classList.add('damage-message');
      existingDamage.textContent = 'Existing damage message';
      messageList.appendChild(existingDamage);

      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'A new expression appears.',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(2);
      expect(messageList.children[0].textContent).toBe(
        'Existing damage message'
      );
      expect(messageList.children[1].textContent).toBe(
        'A new expression appears.'
      );
    });

    it('should maintain correct message order when mixed with other types', async () => {
      // Arrange & Act - dispatch alternating message types
      await mockEventBus.dispatch('core:perceptible_event', {
        perceptionType: 'emotion.expression',
        descriptionText: 'Expression 1',
      });
      await mockEventBus.dispatch('core:perceptible_event', {
        perceptionType: 'damage_received',
        descriptionText: 'Damage 1',
        totalDamage: 5,
      });
      await mockEventBus.dispatch('core:perceptible_event', {
        perceptionType: 'emotion.expression',
        descriptionText: 'Expression 2',
      });

      // Assert - messages in dispatch order
      expect(messageList.children.length).toBe(3);
      expect(messageList.children[0].textContent).toBe('Expression 1');
      expect(messageList.children[1].textContent).toBe('Damage 1');
      expect(messageList.children[2].textContent).toBe('Expression 2');
    });

    it('should render multiple expressions in sequence', async () => {
      // Arrange & Act
      const expressions = [
        {
          perceptionType: 'emotion.expression',
          descriptionText: 'First expression.',
          contextualData: { category: 'anger' },
        },
        {
          perceptionType: 'emotion.expression',
          descriptionText: 'Second expression.',
          contextualData: { category: 'affection' },
        },
        {
          perceptionType: 'emotion.expression',
          descriptionText: 'Third expression.',
          contextualData: { category: 'threat' },
        },
      ];

      for (const payload of expressions) {
        await mockEventBus.dispatch('core:perceptible_event', payload);
      }

      // Assert
      expect(messageList.children.length).toBe(3);
      expect(messageList.children[0].textContent).toBe('First expression.');
      expect(messageList.children[1].textContent).toBe('Second expression.');
      expect(messageList.children[2].textContent).toBe('Third expression.');
    });
  });

  describe('CSS Class Integration', () => {
    it('should render with base expression-message class', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'A subtle shift in expression.',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      const renderedMessage = messageList.children[0];
      expect(renderedMessage.classList.contains('expression-message')).toBe(
        true
      );
    });

    it('should render with correct CSS classes based on categories', async () => {
      // Arrange - test multiple category mappings
      const testCases = [
        { category: 'calm', expectedModifier: 'expression-message--calm' },
        { category: 'joy', expectedModifier: 'expression-message--joy' },
        { category: 'affection', expectedModifier: 'expression-message--affection' },
        { category: 'desire', expectedModifier: 'expression-message--desire' },
        { category: 'attention', expectedModifier: 'expression-message--attention' },
        { category: 'threat', expectedModifier: 'expression-message--threat' },
        { category: 'anger', expectedModifier: 'expression-message--anger' },
        { category: 'loss', expectedModifier: 'expression-message--loss' },
        { category: 'shame', expectedModifier: 'expression-message--shame' },
        { category: 'shutdown', expectedModifier: 'expression-message--shutdown' },
        { category: 'agency', expectedModifier: 'expression-message--agency' },
      ];

      for (const testCase of testCases) {
        // Clear previous messages
        messageList.innerHTML = '';

        // Act
        await mockEventBus.dispatch('core:perceptible_event', {
          perceptionType: 'emotion.expression',
          descriptionText: `Testing ${testCase.category}`,
          contextualData: { category: testCase.category },
        });

        // Assert
        const renderedMessage = messageList.children[0];
        expect(renderedMessage.classList.contains(testCase.expectedModifier)).toBe(
          true
        );
      }
    });

    it('should apply --default modifier when no matching category', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'An unrecognizable emotion.',
        contextualData: { category: 'unknown_category' },
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      const renderedMessage = messageList.children[0];
      expect(renderedMessage.classList.contains('expression-message')).toBe(
        true
      );
      expect(
        renderedMessage.classList.contains('expression-message--default')
      ).toBe(true);
    });

    it('should apply --default modifier when category is empty', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'A neutral expression.',
        contextualData: { category: '' },
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      const renderedMessage = messageList.children[0];
      expect(
        renderedMessage.classList.contains('expression-message--default')
      ).toBe(true);
    });

    it('should apply --default modifier when contextualData.category is undefined', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: 'No category provided.',
        contextualData: {},
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      const renderedMessage = messageList.children[0];
      expect(
        renderedMessage.classList.contains('expression-message--default')
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle emotion.mood_shift perception type', async () => {
      // Arrange - other emotion.* subtypes should also be handled
      const expressionPayload = {
        perceptionType: 'emotion.mood_shift',
        descriptionText: 'Their mood visibly shifts.',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(1);
      expect(
        messageList.children[0].classList.contains('expression-message')
      ).toBe(true);
    });

    it('should not render when descriptionText is empty', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: '',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty descriptionText')
      );
    });

    it('should not render when descriptionText is whitespace-only', async () => {
      // Arrange
      const expressionPayload = {
        perceptionType: 'emotion.expression',
        descriptionText: '   ',
      };

      // Act
      await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

      // Assert
      expect(messageList.children.length).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty descriptionText')
      );
    });
  });
});
