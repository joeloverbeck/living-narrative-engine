/**
 * @file Unit tests for the DamageEventMessageRenderer class.
 * @see Ticket INJREPANDUSEINT-009
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
import { DamageEventMessageRenderer } from '../../../src/domUI/damageEventMessageRenderer.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

// Mock dependencies
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
  dispatch: jest.fn(),
};

let mockMessageList;
let mockScrollContainer;
let mockDocumentContext;

describe('DamageEventMessageRenderer', () => {
  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
    eventListeners = {};

    // Mock the DOM environment
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
    // Clean up
    eventListeners = null;
    mockMessageList = null;
    mockScrollContainer = null;
    mockDocumentContext = null;
  });

  /**
   * Helper to create renderer instance with default mocks
   */
  const createRenderer = () => {
    return new DamageEventMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
    });
  };

  describe('Initialization', () => {
    it('should instantiate without errors and bind to the message list', () => {
      createRenderer();
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#message-list');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#outputDiv');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should subscribe to all 3 damage events on construction', () => {
      createRenderer();
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(3);
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:entity_dying',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.any(Function)
      );
    });
  });

  describe('core:perceptible_event (damage_received) Handling', () => {
    it('should create and append a damage message on perceptible_event with damage_received type', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const perceptiblePayload = {
        perceptionType: 'damage_received',
        descriptionText: 'You take 15 damage to your arm.',
        totalDamage: 15,
      };

      const handler = eventListeners['core:perceptible_event'];
      handler({ payload: perceptiblePayload });

      // Allow microtask to flush
      await Promise.resolve();

      expect(mockDomElementFactory.li).toHaveBeenCalled();
      expect(mockLiElement.textContent).toBe('You take 15 damage to your arm.');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--moderate');
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
    });

    it('should ignore perceptible_event with non-damage perceptionType', async () => {
      createRenderer();

      const perceptiblePayload = {
        perceptionType: 'speech',
        descriptionText: 'Someone says hello.',
      };

      const handler = eventListeners['core:perceptible_event'];
      handler({ payload: perceptiblePayload });

      await Promise.resolve();

      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('should skip render when descriptionText is empty', async () => {
      createRenderer();

      const perceptiblePayload = {
        perceptionType: 'damage_received',
        descriptionText: '',
        totalDamage: 10,
      };

      const handler = eventListeners['core:perceptible_event'];
      handler({ payload: perceptiblePayload });

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty descriptionText')
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
    });
  });

  describe('entity_dying Event Handling', () => {
    it('should create a dying message on entity_dying event', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const dyingPayload = {
        entityId: 'entity-1',
        entityName: 'Goblin',
      };

      const handler = eventListeners['anatomy:entity_dying'];
      handler({ payload: dyingPayload });

      await Promise.resolve();

      expect(mockLiElement.textContent).toBe('Goblin is dying!');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--dying');
      expect(mockMessageList.appendChild).toHaveBeenCalled();
    });

    it('should use fallback text when entityName is missing', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const dyingPayload = {
        entityId: 'entity-1',
      };

      const handler = eventListeners['anatomy:entity_dying'];
      handler({ payload: dyingPayload });

      await Promise.resolve();

      expect(mockLiElement.textContent).toBe('An entity is dying!');
    });
  });

  describe('entity_died Event Handling', () => {
    it('should create a death message on entity_died event', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const deathPayload = {
        entityId: 'entity-1',
        entityName: 'Orc',
      };

      const handler = eventListeners['anatomy:entity_died'];
      handler({ payload: deathPayload });

      await Promise.resolve();

      expect(mockLiElement.textContent).toBe('Orc falls dead from their injuries.');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--death');
      expect(mockMessageList.appendChild).toHaveBeenCalled();
    });

    it('should use finalMessage when provided', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const deathPayload = {
        entityId: 'entity-1',
        entityName: 'Orc',
        finalMessage: 'Orc dies from massive head trauma.',
      };

      const handler = eventListeners['anatomy:entity_died'];
      handler({ payload: deathPayload });

      await Promise.resolve();

      expect(mockLiElement.textContent).toBe('Orc dies from massive head trauma.');
    });

    it('should use fallback text when entityName is missing', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const deathPayload = {
        entityId: 'entity-1',
      };

      const handler = eventListeners['anatomy:entity_died'];
      handler({ payload: deathPayload });

      await Promise.resolve();

      expect(mockLiElement.textContent).toBe('An entity falls dead from their injuries.');
    });
  });

  describe('Severity CSS Classes', () => {
    it('should apply minor class for damage < 10', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Minor scratch.',
          totalDamage: 5,
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--minor');
    });

    it('should apply moderate class for damage 10-25', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Moderate wound.',
          totalDamage: 20,
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--moderate');
    });

    it('should apply severe class for damage 26-50', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Severe injury.',
          totalDamage: 40,
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--severe');
    });

    it('should apply critical class for damage > 50', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Critical hit!',
          totalDamage: 75,
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--critical');
    });

    it('should default to minor class when totalDamage is undefined', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Some damage.',
        },
      });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--minor');
    });
  });

  describe('Error Dispatching', () => {
    it('dispatches system_error when message list is missing', async () => {
      // Reconfigure DocumentContext to omit the message list element
      mockDocumentContext.query = jest.fn((selector) => {
        if (selector === '#outputDiv') {
          return mockScrollContainer;
        }
        return null;
      });

      createRenderer();
      mockValidatedEventDispatcher.dispatch.mockClear();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);

      const handler = eventListeners['core:perceptible_event'];
      handler({
        payload: {
          perceptionType: 'damage_received',
          descriptionText: 'Damage!',
          totalDamage: 10,
        },
      });

      await Promise.resolve();

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
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
          perceptionType: 'damage_received',
          descriptionText: 'Damage!',
          totalDamage: 10,
        },
      });

      await Promise.resolve();

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('DomElementFactory.li() returned null'),
        })
      );
    });
  });

  describe('Not Subscribing to Irrelevant Events', () => {
    it('should not subscribe to irrelevant events', () => {
      createRenderer();
      const subscribedEventNames =
        mockValidatedEventDispatcher.subscribe.mock.calls.map((call) => call[0]);
      expect(subscribedEventNames).not.toContain('core:display_message');
      expect(subscribedEventNames).not.toContain('some:other_event');
      expect(subscribedEventNames.length).toBe(3);
    });
  });
});
