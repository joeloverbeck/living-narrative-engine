/**
 * @file Integration test for TurnOrderTickerRenderer render workflow.
 * Tests the complete flow from round_started event to rendered DOM elements.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TurnOrderTickerRenderer } from '../../../src/domUI/turnOrderTickerRenderer.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('TurnOrderTickerRenderer - Integration: Render Workflow', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock logger
    mockLogger = createMockLogger();

    // Create container with required elements
    mockActorQueue = document.createElement('div');
    mockActorQueue.id = 'ticker-actor-queue';
    // Add scrollTo method that jsdom doesn't provide
    mockActorQueue.scrollTo = jest.fn();

    mockRoundNumber = document.createElement('span');
    mockRoundNumber.id = 'ticker-round-number';

    mockContainer = document.createElement('div');
    mockContainer.id = 'turn-order-ticker';
    mockContainer.appendChild(mockRoundNumber);
    mockContainer.appendChild(mockActorQueue);
    document.body.appendChild(mockContainer);

    // Track event subscriptions
    subscribedHandlers = {};

    // Create production-like dependencies
    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn(); // Unsubscribe function
      }),
      unsubscribe: jest.fn(),
    };

    const mockDomElementFactory = {
      create: jest.fn(tag => document.createElement(tag)),
      div: jest.fn((cls) => {
        const el = document.createElement('div');
        if (cls) {
          if (Array.isArray(cls)) {
            el.classList.add(...cls);
          } else {
            el.classList.add(...cls.split(' ').filter(c => c));
          }
        }
        return el;
      }),
      span: jest.fn((cls, text) => {
        const el = document.createElement('span');
        if (cls) {
          if (Array.isArray(cls)) {
            el.classList.add(...cls);
          } else {
            el.classList.add(...cls.split(' ').filter(c => c));
          }
        }
        if (text !== undefined) {
          el.textContent = text;
        }
        return el;
      }),
      img: jest.fn((src, alt, cls) => {
        const el = document.createElement('img');
        el.src = src;
        el.alt = alt;
        if (cls) {
          if (Array.isArray(cls)) {
            el.classList.add(...cls);
          } else {
            el.classList.add(...cls.split(' ').filter(c => c));
          }
        }
        return el;
      }),
    };

    const mockEntityManager = {
      getEntityInstance: jest.fn(id => ({ id })),
      hasComponent: jest.fn(() => false),
      getComponentData: jest.fn(),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
      getEntityPortraitPath: jest.fn(() => null),
    };

    // Create renderer with real dependencies
    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    document.body.innerHTML = '';
  });

  it('should render actors when round_started event is dispatched', () => {
    // Verify event subscription
    expect(subscribedHandlers).toHaveProperty('core:round_started');

    // Dispatch round_started event
    const event = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event);

    // Verify DOM elements were created
    expect(mockActorQueue.children.length).toBe(3);

    // Verify actor elements have correct structure
    const firstActor = mockActorQueue.children[0];
    expect(firstActor.classList.contains('ticker-actor')).toBe(true);
    expect(firstActor.querySelector('.ticker-actor-name').textContent).toBe('Actor 1');

    // Verify round number was updated
    expect(mockRoundNumber.textContent).toBe('ROUND 1');

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Round started'),
      expect.objectContaining({
        roundNumber: 1,
        actorCount: 3,
      })
    );
  });

  it('should clear and re-render when multiple round_started events occur', () => {
    // First round
    const event1 = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event1);
    expect(mockActorQueue.children.length).toBe(2);

    // Second round (should clear and re-render)
    const event2 = {
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: ['actor-3', 'actor-4', 'actor-5'],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event2);

    // Should only have new actors
    expect(mockActorQueue.children.length).toBe(3);
    expect(mockActorQueue.children[0].querySelector('.ticker-actor-name').textContent).toBe('Actor 3');
    expect(mockRoundNumber.textContent).toBe('ROUND 2');
  });

  it('should render empty queue message when no actors', () => {
    const event = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: [],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event);

    // Verify empty message
    expect(mockActorQueue.children.length).toBe(1);
    expect(mockActorQueue.children[0].className).toBe('ticker-empty-message');
    expect(mockActorQueue.children[0].textContent).toBe('No participating actors');
  });

  it('should handle invalid event payload gracefully', () => {
    const event = {
      type: 'core:round_started',
      payload: null,
    };

    // Should not throw
    expect(() => subscribedHandlers['core:round_started'](event)).not.toThrow();

    // Should log warning
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Invalid round_started event payload',
      expect.any(Object)
    );

    // Queue should remain empty
    expect(mockActorQueue.children.length).toBe(0);
  });

  it('should create actor elements with portrait when available', () => {
    // Mock entity with portrait
    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: jest.fn(selector => document.querySelector(selector)),
        create: jest.fn(tag => document.createElement(tag)),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn((eventType, handler) => {
          subscribedHandlers[eventType] = handler;
          return jest.fn();
        }),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        create: jest.fn(tag => document.createElement(tag)),
        div: jest.fn((cls) => {
          const el = document.createElement('div');
          if (cls) {
            if (Array.isArray(cls)) {
              el.classList.add(...cls);
            } else {
              el.classList.add(...cls.split(' ').filter(c => c));
            }
          }
          return el;
        }),
        span: jest.fn((cls, text) => {
          const el = document.createElement('span');
          if (cls) {
            if (Array.isArray(cls)) {
              el.classList.add(...cls);
            } else {
              el.classList.add(...cls.split(' ').filter(c => c));
            }
          }
          if (text !== undefined) {
            el.textContent = text;
          }
          return el;
        }),
        img: jest.fn((src, alt, cls) => {
          const el = document.createElement('img');
          el.src = src;
          el.alt = alt;
          if (cls) {
            if (Array.isArray(cls)) {
              el.classList.add(...cls);
            } else {
              el.classList.add(...cls.split(' ').filter(c => c));
            }
          }
          return el;
        }),
      },
      entityManager: {
        getEntityInstance: jest.fn(id => ({ id })),
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(),
      },
      entityDisplayDataProvider: {
        getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
        getEntityPortraitPath: jest.fn(() => '/path/to/portrait.jpg'),
      },
      tickerContainerElement: mockContainer,
    });

    const event = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event);

    // Verify portrait element exists
    const actorElement = mockActorQueue.children[0];
    const portrait = actorElement.querySelector('.ticker-actor-portrait');
    expect(portrait).not.toBeNull();
    expect(portrait.src).toContain('portrait.jpg');
  });

  it('should apply entrance animation class to each actor', () => {
    const event = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    };

    subscribedHandlers['core:round_started'](event);

    // Verify animation class was added (stub implementation adds 'entering' class)
    expect(mockActorQueue.children[0].classList.contains('entering')).toBe(true);
    expect(mockActorQueue.children[1].classList.contains('entering')).toBe(true);
  });
});
