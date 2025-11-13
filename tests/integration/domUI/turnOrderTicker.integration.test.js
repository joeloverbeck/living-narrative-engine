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

    // Mock window.matchMedia for animation tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

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

describe('TurnOrderTickerRenderer - Integration: Current Actor Highlighting', () => {
  // eslint-disable-next-line no-unused-vars -- Renderer must be instantiated to register event handlers
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
      create: jest.fn(config => {
        const el = document.createElement(config.tag || 'div');
        if (config.classes) el.className = config.classes.join(' ');
        if (config.attributes) {
          Object.entries(config.attributes).forEach(([key, value]) => {
            el.setAttribute(key, value);
          });
        }
        if (config.children) {
          config.children.forEach(child => el.appendChild(child));
        }
        return el;
      }),
      div: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'div' })),
      span: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'span' })),
      img: jest.fn(config => mockDomElementFactory.create({ ...config, tag: 'img' })),
    };

    const mockEntityManager = {
      getEntityInstance: jest.fn(id => ({ id })),
      hasComponent: jest.fn(() => true),
      getComponentData: jest.fn(() => ({})),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id}`),
      getEntityPortraitPath: jest.fn(() => '/path/to/portrait.jpg'),
    };

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
    document.body.innerHTML = '';
  });

  it('should highlight current actor on core:turn_started event', () => {
    // First, render actors via round_started event
    const roundStartedEvent = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    };
    subscribedHandlers['core:round_started'](roundStartedEvent);

    // Verify actors are rendered
    expect(mockActorQueue.children.length).toBe(3);

    // Now trigger turn_started event
    const turnStartedEvent = {
      type: 'core:turn_started',
      payload: {
        entityId: 'actor-2',
        roundNumber: 1,
      },
    };
    subscribedHandlers['core:turn_started'](turnStartedEvent);

    // Verify correct actor is highlighted
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    const actor3 = mockActorQueue.querySelector('[data-entity-id="actor-3"]');

    expect(actor1.classList.contains('current')).toBe(false);
    expect(actor2.classList.contains('current')).toBe(true);
    expect(actor3.classList.contains('current')).toBe(false);

    // Verify debug logging
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'updateCurrentActor: Added .current class to actor',
      { entityId: 'actor-2' }
    );
  });

  it('should move highlight between actors across multiple turns', () => {
    // Render actors
    const roundStartedEvent = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    };
    subscribedHandlers['core:round_started'](roundStartedEvent);

    // Turn 1: actor-1
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    let actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    let actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    let actor3 = mockActorQueue.querySelector('[data-entity-id="actor-3"]');

    expect(actor1.classList.contains('current')).toBe(true);
    expect(actor2.classList.contains('current')).toBe(false);
    expect(actor3.classList.contains('current')).toBe(false);

    // Turn 2: actor-2
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-2', roundNumber: 1 },
    });

    expect(actor1.classList.contains('current')).toBe(false);
    expect(actor2.classList.contains('current')).toBe(true);
    expect(actor3.classList.contains('current')).toBe(false);

    // Turn 3: actor-3
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-3', roundNumber: 1 },
    });

    expect(actor1.classList.contains('current')).toBe(false);
    expect(actor2.classList.contains('current')).toBe(false);
    expect(actor3.classList.contains('current')).toBe(true);

    // Verify only one actor is highlighted at the end
    const allHighlighted = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(allHighlighted.length).toBe(1);
    expect(allHighlighted[0].getAttribute('data-entity-id')).toBe('actor-3');
  });
});

describe('Turn Order Ticker - Participation Updates', () => {
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

    // Create production-like dependencies (matching existing pattern)
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

  it('should update visual state when participation changes', () => {
    // Render actors
    const roundStartedEvent = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    };
    subscribedHandlers['core:round_started'](roundStartedEvent);

    const actorElement = mockActorQueue.querySelector('[data-entity-id="actor-1"]');

    // Initially participating
    expect(actorElement.getAttribute('data-participating')).toBe('true');

    // Dispatch component_added event
    const componentAddedEvent = {
      type: 'core:component_added',
      payload: {
        entityId: 'actor-1',
        componentId: 'core:participation',
        data: { participating: false },
      },
    };
    subscribedHandlers['core:component_added'](componentAddedEvent);

    expect(actorElement.getAttribute('data-participating')).toBe('false');
  });

  it('should handle participation toggle during round', () => {
    // Render actors
    const roundStartedEvent = {
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    };
    subscribedHandlers['core:round_started'](roundStartedEvent);

    // Start actor-1's turn
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    // Disable actor-2 mid-round
    subscribedHandlers['core:component_added']({
      type: 'core:component_added',
      payload: {
        entityId: 'actor-2',
        componentId: 'core:participation',
        data: { participating: false },
      },
    });

    const actor2Element = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    expect(actor2Element.getAttribute('data-participating')).toBe('false');
  });

  describe('Entry Animations', () => {
    it('should animate all actors entering when round starts', () => {
      jest.useFakeTimers();

      // Dispatch round_started event which should trigger actor rendering
      const event = {
        type: 'core:round_started',
        payload: {
          roundNumber: 1,
          actors: ['actor-1', 'actor-2', 'actor-3'],
          strategy: 'sequential',
        },
      };

      subscribedHandlers['core:round_started'](event);

      // Get the rendered actor elements
      const actorElements = Array.from(mockActorQueue.querySelectorAll('.ticker-actor'));
      expect(actorElements.length).toBe(3);

      // Verify all actors have entering class
      actorElements.forEach((element, index) => {
        expect(element.classList.contains('entering')).toBe(true);

        // Verify stagger delays
        const expectedDelay = `${index * 100}ms`;
        expect(element.style.animationDelay).toBe(expectedDelay);
      });

      // Fast-forward past all animations
      // Max delay is 200ms (for actor-3), plus 500ms animation, plus 50ms buffer = 750ms
      jest.advanceTimersByTime(1000);

      // Verify all entering classes are removed
      actorElements.forEach(element => {
        expect(element.classList.contains('entering')).toBe(false);
        expect(element.style.animationDelay).toBe('');
      });

      jest.useRealTimers();
    });
  });
});
