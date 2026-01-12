/**
 * @file Unit tests for the ExpressionMessageRenderer class.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { ExpressionMessageRenderer } from '../../../src/domUI/expressionMessageRenderer.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockDomElementFactory = {
  create: jest.fn((tag) => document.createElement(tag)),
  li: jest.fn(),
};

let eventListeners;

const mockSafeEventDispatcher = {
  subscribe: jest.fn((eventName, listener) => {
    eventListeners[eventName] = listener;
    return () => {
      delete eventListeners[eventName];
    };
  }),
  dispatch: jest.fn(),
};

let mockMessageList;
let mockScrollContainer;
let mockDocumentContext;

describe('ExpressionMessageRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventListeners = {};

    mockMessageList = {
      appendChild: jest.fn(),
      scrollTop: 0,
      scrollHeight: 100,
    };
    mockScrollContainer = {
      scrollTop: 0,
      scrollHeight: 250,
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
      create: jest.fn(),
    };
  });

  afterEach(() => {
    eventListeners = null;
    mockMessageList = null;
    mockScrollContainer = null;
    mockDocumentContext = null;
  });

  const createRenderer = () =>
    new ExpressionMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      domElementFactory: mockDomElementFactory,
    });

  describe('Initialization', () => {
    it('should bind to the message list and scroll container', () => {
      createRenderer();
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#message-list');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#outputDiv');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should subscribe to core:perceptible_event on construction', () => {
      createRenderer();
      expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
      expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.any(Function)
      );
    });
  });

  describe('core:perceptible_event Handling', () => {
    it('should render a message for emotion.expression events', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'A wave of relief washes over them.',
        },
      });

      await Promise.resolve();

      expect(mockDomElementFactory.li).toHaveBeenCalled();
      expect(mockLiElement.textContent).toBe(
        'A wave of relief washes over them.'
      );
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
    });

    it('should render a message for other emotion.* events', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.mood_shift',
          descriptionText: 'Their mood shifts unexpectedly.',
        },
      });

      await Promise.resolve();

      expect(mockDomElementFactory.li).toHaveBeenCalled();
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
    });

    it('should ignore non-emotion events', async () => {
      createRenderer();

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Damage!',
        },
      });

      await Promise.resolve();

      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('should ignore events with missing perceptionType', async () => {
      createRenderer();

      const handler = eventListeners['core:perceptible_event'];
      handler({ payload: { descriptionText: 'Missing perception type.' } });

      await Promise.resolve();

      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
    });

    it('should warn and skip when descriptionText is empty', async () => {
      createRenderer();

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: '',
        },
      });

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty descriptionText')
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
    });

    it('should warn and skip when descriptionText is whitespace', async () => {
      createRenderer();

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: '   ',
        },
      });

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty descriptionText')
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
    });
  });

  describe('CSS Class Building', () => {
    it('should apply base and category modifier classes for known category', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'Anger rises.',
          contextualData: { category: 'anger' },
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message'
      );
      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message--anger'
      );
    });

    it('should apply correct modifier for each category', async () => {
      const categories = [
        'calm',
        'joy',
        'affection',
        'desire',
        'attention',
        'threat',
        'anger',
        'loss',
        'shame',
        'shutdown',
        'agency',
      ];

      for (const category of categories) {
        jest.clearAllMocks();
        createRenderer();

        const mockLiElement = {
          textContent: '',
          classList: { add: jest.fn() },
        };
        mockDomElementFactory.li.mockReturnValue(mockLiElement);

        const handler = eventListeners['core:perceptible_event'];
        handler({
          payload: {
            perceptionType: 'emotion.expression',
            descriptionText: `Testing ${category}.`,
            contextualData: { category },
          },
        });

        await Promise.resolve();

        expect(mockLiElement.classList.add).toHaveBeenCalledWith(
          'expression-message'
        );
        expect(mockLiElement.classList.add).toHaveBeenCalledWith(
          `expression-message--${category}`
        );
      }
    });

    it('should apply default modifier when category is unknown', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'An unreadable feeling passes.',
          contextualData: { category: 'unknown_category' },
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message--default'
      );
    });

    it('should apply default modifier when category is absent', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'A neutral shift occurs.',
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message--default'
      );
    });

    it('should apply default modifier when contextualData is missing', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'No contextual data.',
          contextualData: null,
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message--default'
      );
    });

    it('should apply default modifier when category is empty string', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'Empty category string.',
          contextualData: { category: '' },
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith(
        'expression-message--default'
      );
    });
  });

  describe('Error Dispatching', () => {
    it('dispatches system_error when message list is missing', async () => {
      mockDocumentContext.query = jest.fn((selector) => {
        if (selector === '#outputDiv') {
          return mockScrollContainer;
        }
        return null;
      });

      createRenderer();
      mockSafeEventDispatcher.dispatch.mockClear();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'No list to render.',
        },
      });

      await Promise.resolve();

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('listContainerElement not found'),
        })
      );
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('dispatches system_error when DomElementFactory.li returns null', async () => {
      createRenderer();
      mockDomElementFactory.li.mockReturnValue(null);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'emotion.expression',
          descriptionText: 'No element.',
        },
      });

      await Promise.resolve();

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('DomElementFactory.li() returned null'),
        })
      );
    });
  });
});
