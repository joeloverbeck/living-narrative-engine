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

const mockNarrativeFormatter = {
  formatDamageEvent: jest.fn(),
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
      narrativeFormatter: mockNarrativeFormatter,
    });
  };

  describe('Initialization', () => {
    it('should instantiate without errors and bind to the message list', () => {
      createRenderer();
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#message-list');
      expect(mockDocumentContext.query).toHaveBeenCalledWith('#outputDiv');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should subscribe to all 5 damage events on construction', () => {
      createRenderer();
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(5);
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:damage_applied',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:internal_damage_propagated',
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
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:dismembered',
        expect.any(Function)
      );
    });

    it('should throw if narrativeFormatter is missing', () => {
      expect(() => {
        new DamageEventMessageRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          narrativeFormatter: null,
        });
      }).toThrow('narrativeFormatter dependency must have formatDamageEvent method');
    });

    it('should throw if narrativeFormatter lacks formatDamageEvent method', () => {
      expect(() => {
        new DamageEventMessageRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          narrativeFormatter: { someOtherMethod: jest.fn() },
        });
      }).toThrow('narrativeFormatter dependency must have formatDamageEvent method');
    });
  });

  describe('damage_applied Event Handling', () => {
    it('should create and append a damage message on damage_applied event', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('You take 15 damage to your arm.');

      const damagePayload = {
        entityName: 'Player',
        damageAmount: 15,
        partType: 'arm',
        damageType: 'slashing',
      };

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: damagePayload });

      // Allow microtask to flush
      await Promise.resolve();

      expect(mockNarrativeFormatter.formatDamageEvent).toHaveBeenCalledWith(
        expect.objectContaining(damagePayload)
      );
      expect(mockDomElementFactory.li).toHaveBeenCalled();
      expect(mockLiElement.textContent).toBe('You take 15 damage to your arm.');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--moderate');
      expect(mockMessageList.appendChild).toHaveBeenCalledWith(mockLiElement);
    });
  });

  describe('internal_damage_propagated Event Handling', () => {
    it('should create and append a damage message on internal_damage_propagated event', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Internal damage spreads.');

      const damagePayload = {
        entityName: 'Player',
        damageAmount: 5,
        partType: 'organ',
      };

      const handler = eventListeners['anatomy:internal_damage_propagated'];
      handler({ payload: damagePayload });

      await Promise.resolve();

      expect(mockNarrativeFormatter.formatDamageEvent).toHaveBeenCalled();
      expect(mockMessageList.appendChild).toHaveBeenCalled();
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

      // Should NOT call narrative formatter for dying events
      expect(mockNarrativeFormatter.formatDamageEvent).not.toHaveBeenCalled();
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

      // Should NOT call narrative formatter for death events
      expect(mockNarrativeFormatter.formatDamageEvent).not.toHaveBeenCalled();
      expect(mockLiElement.textContent).toBe('Orc has died.');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message');
      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--death');
      expect(mockMessageList.appendChild).toHaveBeenCalled();
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

      expect(mockLiElement.textContent).toBe('An entity has died.');
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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Minor scratch.');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 5 } });

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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Moderate wound.');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 20 } });

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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Severe injury.');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 40 } });

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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Critical hit!');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 75 } });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--critical');
    });

    it('should default to minor class when damageAmount is undefined', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Some damage.');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: {} });

      await Promise.resolve();

      expect(mockLiElement.classList.add).toHaveBeenCalledWith('damage-message--minor');
    });
  });

  describe('Batching Behavior', () => {
    it('should batch multiple events in the same microtask', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Damage message.');

      const handler = eventListeners['anatomy:damage_applied'];

      // Dispatch 3 events synchronously with distinct IDs to prevent merging
      handler({ payload: { entityId: 'e1', partId: 'p1', damageType: 'slashing', damageAmount: 5 } });
      handler({ payload: { entityId: 'e2', partId: 'p2', damageType: 'blunt', damageAmount: 15 } });
      handler({ payload: { entityId: 'e3', partId: 'p3', damageType: 'piercing', damageAmount: 55 } });

      // Before microtask flushes, nothing should be rendered
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();

      // Allow microtask to flush
      await Promise.resolve();

      // All 3 should be rendered
      expect(mockMessageList.appendChild).toHaveBeenCalledTimes(3);
    });

    it('should log batch flush with correct count', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Damage.');

      const handler = eventListeners['anatomy:damage_applied'];

      // Use distinct IDs to prevent merging
      handler({ payload: { entityId: 'e1', partId: 'p1', damageType: 'slashing', damageAmount: 10 } });
      handler({ payload: { entityId: 'e2', partId: 'p2', damageType: 'blunt', damageAmount: 20 } });

      await Promise.resolve();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Flushing batch of 2 damage event(s)'),
        expect.any(Array)
      );
    });
  });

  describe('Malformed Payloads', () => {
    it('should log a warning and skip render for null event data', async () => {
      createRenderer();

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: null });

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Received null/undefined event data')
      );
      expect(mockDomElementFactory.li).not.toHaveBeenCalled();
    });

    it('should log a warning and skip render when formatter returns empty string', async () => {
      createRenderer();

      const mockLiElement = {
        textContent: '',
        classList: { add: jest.fn() },
      };
      mockDomElementFactory.li.mockReturnValue(mockLiElement);
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 10 } });

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty message generated for damage event'),
        expect.any(Object)
      );
      // li is not called because we check message before rendering
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Damage!');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 10 } });

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
      mockNarrativeFormatter.formatDamageEvent.mockReturnValue('Damage!');

      const handler = eventListeners['anatomy:damage_applied'];
      handler({ payload: { damageAmount: 10 } });

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
      expect(subscribedEventNames.length).toBe(5);
    });
  });
});
