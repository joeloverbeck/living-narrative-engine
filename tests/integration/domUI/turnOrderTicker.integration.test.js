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

  describe('Exit Animations', () => {
    let mockLogger;
    let mockContainer;
    let mockActorQueue;
    let mockRoundNumber;
    let subscribedHandlers;
    // Renderer is used indirectly via subscribedHandlers populated during construction
    // eslint-disable-next-line no-unused-vars
    let renderer;

    beforeEach(() => {
      // Reset DOM
      document.body.innerHTML = '';

      // Mock window.matchMedia for animation tests
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
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

      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

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

      subscribedHandlers = {};

      const mockDocumentContext = {
        query: jest.fn((selector) => document.querySelector(selector)),
        create: jest.fn((tag) => document.createElement(tag)),
      };

      const mockValidatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn((eventType, handler) => {
          subscribedHandlers[eventType] = handler;
          return jest.fn();
        }),
        unsubscribe: jest.fn(),
      };

      const mockDomElementFactory = {
        create: jest.fn((tag) => document.createElement(tag)),
        div: jest.fn((cls) => {
          const el = document.createElement('div');
          if (cls) {
            if (Array.isArray(cls)) {
              el.classList.add(...cls);
            } else {
              el.classList.add(...cls.split(' ').filter((c) => c));
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
              el.classList.add(...cls.split(' ').filter((c) => c));
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
              el.classList.add(...cls.split(' ').filter((c) => c));
            }
          }
          return el;
        }),
      };

      const mockEntityManager = {
        getEntityInstance: jest.fn(),
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(),
      };

      const mockEntityDisplayDataProvider = {
        getEntityName: jest.fn((id) => `Actor ${id}`),
        getEntityPortraitPath: jest.fn(),
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

    it('should animate actor removal on turn end', async () => {
      // Start round with actors
      const roundStartedHandler = subscribedHandlers['core:round_started'];
      roundStartedHandler({
        payload: {
          roundNumber: 1,
          actors: ['actor-1', 'actor-2'],
          strategy: 'round-robin',
        },
      });

      const queueElement = document.querySelector('#ticker-actor-queue');
      expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(2);

      // End turn
      const turnEndedHandler = subscribedHandlers['core:turn_ended'];
      const turnEndedPromise = turnEndedHandler({
        payload: { entityId: 'actor-1' },
      });

      // Should have exiting class during animation
      const actor1Element = queueElement.querySelector('[data-entity-id="actor-1"]');
      expect(actor1Element?.classList.contains('exiting')).toBe(true);

      // Wait for animation
      await turnEndedPromise;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Extra buffer

      // Should be removed after animation
      expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();
      expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(1);
    });
  });
});

describe('TurnOrderTickerRenderer - Integration: Multi-Round Progression', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should handle 5 consecutive rounds with different actor queues', () => {
    const rounds = [
      { roundNumber: 1, actors: ['actor-1', 'actor-2', 'actor-3'] },
      { roundNumber: 2, actors: ['actor-4', 'actor-5'] },
      { roundNumber: 3, actors: ['actor-1', 'actor-3', 'actor-6'] },
      { roundNumber: 4, actors: ['actor-2', 'actor-4', 'actor-5', 'actor-6'] },
      { roundNumber: 5, actors: ['actor-1'] },
    ];

    rounds.forEach(({ roundNumber, actors }) => {
      const event = {
        type: 'core:round_started',
        payload: {
          roundNumber,
          actors,
          strategy: 'sequential',
        },
      };

      subscribedHandlers['core:round_started'](event);

      // Verify correct number of actors rendered
      expect(mockActorQueue.children.length).toBe(actors.length);

      // Verify round number updated
      expect(mockRoundNumber.textContent).toBe(`ROUND ${roundNumber}`);

      // Verify correct actors are rendered
      actors.forEach((actorId, index) => {
        const actorElement = mockActorQueue.children[index];
        expect(actorElement.getAttribute('data-entity-id')).toBe(actorId);
      });
    });
  });

  it('should properly clean up DOM between rounds', () => {
    // Round 1 with 3 actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    const round1Elements = Array.from(mockActorQueue.querySelectorAll('.ticker-actor'));
    expect(round1Elements.length).toBe(3);

    // Round 2 with different actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: ['actor-4', 'actor-5'],
        strategy: 'sequential',
      },
    });

    // Old actors should be completely removed
    expect(mockActorQueue.querySelector('[data-entity-id="actor-1"]')).toBeNull();
    expect(mockActorQueue.querySelector('[data-entity-id="actor-2"]')).toBeNull();
    expect(mockActorQueue.querySelector('[data-entity-id="actor-3"]')).toBeNull();

    // New actors should be present
    expect(mockActorQueue.querySelector('[data-entity-id="actor-4"]')).not.toBeNull();
    expect(mockActorQueue.querySelector('[data-entity-id="actor-5"]')).not.toBeNull();
    expect(mockActorQueue.querySelectorAll('.ticker-actor').length).toBe(2);
  });

  it('should increment round numbers correctly across multiple rounds', () => {
    for (let i = 1; i <= 10; i++) {
      subscribedHandlers['core:round_started']({
        type: 'core:round_started',
        payload: {
          roundNumber: i,
          actors: ['actor-1'],
          strategy: 'sequential',
        },
      });

      expect(mockRoundNumber.textContent).toBe(`ROUND ${i}`);
    }
  });

  it('should handle actor queue refresh properly across rounds', () => {
    // Round 1
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Highlight actor-1
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    let actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.classList.contains('current')).toBe(true);

    // Round 2 with same actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Highlighting should be cleared on new round
    actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.classList.contains('current')).toBe(false);
  });
});

describe('TurnOrderTickerRenderer - Integration: Mid-Round Actor Removal', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;
  let mockEntityManager;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockLogger = createMockLogger();

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

    mockEntityManager = {
      getEntityInstance: jest.fn(id => ({ id })),
      hasComponent: jest.fn(() => false),
      getComponentData: jest.fn(),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
      getEntityPortraitPath: jest.fn(() => null),
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
    if (renderer) {
      renderer.dispose();
    }
    document.body.innerHTML = '';
  });

  it('should handle entity removal during active round', async () => {
    // Start round with 3 actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    expect(mockActorQueue.children.length).toBe(3);

    // Simulate entity removal (via turn_ended)
    await subscribedHandlers['core:turn_ended']({
      type: 'core:turn_ended',
      payload: { entityId: 'actor-2' },
    });

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Actor should be removed
    expect(mockActorQueue.querySelector('[data-entity-id="actor-2"]')).toBeNull();
    expect(mockActorQueue.children.length).toBe(2);
  });

  it('should handle removing current actor mid-round', async () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    // Set actor-2 as current
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-2', roundNumber: 1 },
    });

    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');
    expect(actor2.classList.contains('current')).toBe(true);

    // Remove current actor
    await subscribedHandlers['core:turn_ended']({
      type: 'core:turn_ended',
      payload: { entityId: 'actor-2' },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should be removed
    expect(mockActorQueue.querySelector('[data-entity-id="actor-2"]')).toBeNull();
  });

  it('should maintain correct order after mid-round removal', async () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3', 'actor-4'],
        strategy: 'sequential',
      },
    });

    // Remove actor-2 (middle position)
    await subscribedHandlers['core:turn_ended']({
      type: 'core:turn_ended',
      payload: { entityId: 'actor-2' },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const remaining = Array.from(mockActorQueue.querySelectorAll('.ticker-actor'));
    expect(remaining.length).toBe(3);
    expect(remaining[0].getAttribute('data-entity-id')).toBe('actor-1');
    expect(remaining[1].getAttribute('data-entity-id')).toBe('actor-3');
    expect(remaining[2].getAttribute('data-entity-id')).toBe('actor-4');
  });
});

describe('TurnOrderTickerRenderer - Integration: Stress Testing', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should handle 100 rapid turn_started events without errors', () => {
    // Setup initial round
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    // Dispatch 100 turn_started events rapidly
    const actorIds = ['actor-1', 'actor-2', 'actor-3'];
    for (let i = 0; i < 100; i++) {
      const actorId = actorIds[i % 3];
      expect(() => {
        subscribedHandlers['core:turn_started']({
          type: 'core:turn_started',
          payload: { entityId: actorId, roundNumber: 1 },
        });
      }).not.toThrow();
    }

    // Should still have exactly one current actor
    const currentActors = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(currentActors.length).toBe(1);
  });

  it('should handle 50 round cycles without performance degradation', () => {
    const startTime = Date.now();

    for (let round = 1; round <= 50; round++) {
      subscribedHandlers['core:round_started']({
        type: 'core:round_started',
        payload: {
          roundNumber: round,
          actors: [`actor-${round}-1`, `actor-${round}-2`],
          strategy: 'sequential',
        },
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 1 second for 50 rounds)
    expect(duration).toBeLessThan(1000);

    // Final state should be correct
    expect(mockRoundNumber.textContent).toBe('ROUND 50');
    expect(mockActorQueue.children.length).toBe(2);
  });

  it('should handle concurrent event types without race conditions', () => {
    // Setup round
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Fire multiple events in same tick
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    subscribedHandlers['core:component_added']({
      type: 'core:component_added',
      payload: {
        entityId: 'actor-2',
        componentId: 'core:participation',
        data: { participating: false },
      },
    });

    // State should be consistent
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');

    expect(actor1.classList.contains('current')).toBe(true);
    expect(actor2.getAttribute('data-participating')).toBe('false');
  });
});

describe('TurnOrderTickerRenderer - Integration: Memory Leak Prevention', () => {
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

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
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should not leak DOM elements over 50 create/destroy cycles', () => {
    const initialElementCount = document.querySelectorAll('*').length;

    for (let i = 0; i < 50; i++) {
      const subscribedHandlers = {};

      const mockDocumentContext = {
        query: jest.fn(selector => document.querySelector(selector)),
        create: jest.fn(tag => document.createElement(tag)),
      };

      const mockValidatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn((eventType, handler) => {
          subscribedHandlers[eventType] = handler;
          return jest.fn();
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
        getEntityName: jest.fn(id => `Actor ${id}`),
        getEntityPortraitPath: jest.fn(() => null),
      };

      const renderer = new TurnOrderTickerRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        tickerContainerElement: mockContainer,
      });

      // Render some actors
      subscribedHandlers['core:round_started']({
        type: 'core:round_started',
        payload: {
          roundNumber: i + 1,
          actors: ['actor-1', 'actor-2'],
          strategy: 'sequential',
        },
      });

      // Dispose renderer
      renderer.dispose();
    }

    // Allow a small margin for test infrastructure
    const finalElementCount = document.querySelectorAll('*').length;
    const elementGrowth = finalElementCount - initialElementCount;

    // Should not accumulate more than a few elements per cycle
    expect(elementGrowth).toBeLessThan(10);
  });

  it('should clean up event listeners on dispose', () => {
    const unsubscribeMocks = [];
    const subscribedHandlers = {};

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        const unsubscribeMock = jest.fn();
        unsubscribeMocks.push(unsubscribeMock);
        return unsubscribeMock;
      }),
      unsubscribe: jest.fn(),
    };

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
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
      getEntityName: jest.fn(id => `Actor ${id}`),
      getEntityPortraitPath: jest.fn(() => null),
    };

    const renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Should have subscribed to events
    expect(unsubscribeMocks.length).toBeGreaterThan(0);

    // Dispose
    renderer.dispose();

    // All unsubscribe functions should have been called
    unsubscribeMocks.forEach(unsubscribe => {
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

describe('TurnOrderTickerRenderer - Integration: DOM Lifecycle Management', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should remove old actor elements completely on turn_ended', async () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    const actor1Element = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    expect(actor1Element).not.toBeNull();

    // End turn
    await subscribedHandlers['core:turn_ended']({
      type: 'core:turn_ended',
      payload: { entityId: 'actor-1' },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Element should be completely removed from DOM
    expect(mockActorQueue.querySelector('[data-entity-id="actor-1"]')).toBeNull();
    expect(mockActorQueue.contains(actor1Element)).toBe(false);
  });

  it('should clear container completely on new round_started', () => {
    // Round 1
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    const round1Elements = Array.from(mockActorQueue.children);
    expect(round1Elements.length).toBe(3);

    // Round 2
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: ['actor-4'],
        strategy: 'sequential',
      },
    });

    // All old elements should be removed
    round1Elements.forEach(element => {
      expect(mockActorQueue.contains(element)).toBe(false);
    });

    // Only new element should exist
    expect(mockActorQueue.children.length).toBe(1);
  });

  it('should not create orphaned DOM nodes', () => {
    const initialQueueChildren = mockActorQueue.childElementCount;

    // Render actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    expect(mockActorQueue.childElementCount).toBe(initialQueueChildren + 2);

    // Clear by starting new round with empty actors
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: [],
        strategy: 'sequential',
      },
    });

    // Should only have empty message
    expect(mockActorQueue.childElementCount).toBe(1);
    expect(mockActorQueue.querySelector('.ticker-empty-message')).not.toBeNull();
  });

  it('should maintain proper parent-child relationships', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    const actorElement = mockActorQueue.querySelector('.ticker-actor');
    const nameBadgeElement = actorElement.querySelector('.ticker-actor-name-badge');
    const nameElement = actorElement.querySelector('.ticker-actor-name');

    // Verify proper nesting: mockActorQueue > actorElement > nameBadgeElement > nameElement
    expect(actorElement.parentElement).toBe(mockActorQueue);
    expect(nameBadgeElement.parentElement).toBe(actorElement);
    expect(nameElement.parentElement).toBe(nameBadgeElement);
  });
});

describe('TurnOrderTickerRenderer - Integration: Error Recovery', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should handle malformed round_started payload gracefully', () => {
    const malformedPayloads = [
      null,
      undefined,
      {},
      { roundNumber: 1 }, // missing actors
      { actors: [] }, // missing roundNumber
      { roundNumber: 'invalid', actors: ['actor-1'] }, // invalid type
    ];

    malformedPayloads.forEach(payload => {
      expect(() => {
        subscribedHandlers['core:round_started']({
          type: 'core:round_started',
          payload,
        });
      }).not.toThrow();
    });

    // Should have logged warnings
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should recover from EntityManager lookup failures', () => {
    const mockEntityManager = {
      getEntityInstance: jest.fn(() => {
        throw new Error('Entity not found');
      }),
      hasComponent: jest.fn(() => false),
      getComponentData: jest.fn(),
    };

    // Re-create renderer with failing EntityManager
    if (renderer) {
      renderer.dispose();
    }

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
      getEntityPortraitPath: jest.fn(() => null),
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

    // Should handle gracefully
    expect(() => {
      subscribedHandlers['core:round_started']({
        type: 'core:round_started',
        payload: {
          roundNumber: 1,
          actors: ['actor-1'],
          strategy: 'sequential',
        },
      });
    }).not.toThrow();
  });

  it('should handle missing display data gracefully', () => {
    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(() => {
        throw new Error('Display data not available');
      }),
      getEntityPortraitPath: jest.fn(() => null),
    };

    // Re-create renderer with failing display provider
    if (renderer) {
      renderer.dispose();
    }

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Should still render something (fallback to ID or default)
    expect(() => {
      subscribedHandlers['core:round_started']({
        type: 'core:round_started',
        payload: {
          roundNumber: 1,
          actors: ['actor-1'],
          strategy: 'sequential',
        },
      });
    }).not.toThrow();
  });

  it('should handle turn_started for non-existent actor gracefully', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Try to highlight actor that doesn't exist
    expect(() => {
      subscribedHandlers['core:turn_started']({
        type: 'core:turn_started',
        payload: { entityId: 'actor-999', roundNumber: 1 },
      });
    }).not.toThrow();

    // Should log debug message
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});

describe('TurnOrderTickerRenderer - Integration: Concurrent Event Handling', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

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

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should handle multiple turn_started events in quick succession', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2', 'actor-3'],
        strategy: 'sequential',
      },
    });

    // Fire multiple turn_started events rapidly
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-2', roundNumber: 1 },
    });

    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-3', roundNumber: 1 },
    });

    // Last event should win
    const actor3 = mockActorQueue.querySelector('[data-entity-id="actor-3"]');
    expect(actor3.classList.contains('current')).toBe(true);

    // Only one actor should be current
    const currentActors = mockActorQueue.querySelectorAll('.ticker-actor.current');
    expect(currentActors.length).toBe(1);
  });

  it('should handle overlapping animation timings', async () => {
    jest.useFakeTimers();

    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Elements should have entering animation
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    const actor2 = mockActorQueue.querySelector('[data-entity-id="actor-2"]');

    expect(actor1.classList.contains('entering')).toBe(true);
    expect(actor2.classList.contains('entering')).toBe(true);

    // Fast-forward partway through animations
    jest.advanceTimersByTime(300);

    // Start a new round during animations
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 2,
        actors: ['actor-3'],
        strategy: 'sequential',
      },
    });

    // Old actors should be removed
    expect(mockActorQueue.querySelector('[data-entity-id="actor-1"]')).toBeNull();
    expect(mockActorQueue.querySelector('[data-entity-id="actor-2"]')).toBeNull();

    // New actor should be present
    expect(mockActorQueue.querySelector('[data-entity-id="actor-3"]')).not.toBeNull();

    jest.useRealTimers();
  });

  it('should handle race condition between round_started and component_added', () => {
    // Fire events in quick succession
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    // Immediately fire component_added
    subscribedHandlers['core:component_added']({
      type: 'core:component_added',
      payload: {
        entityId: 'actor-1',
        componentId: 'core:participation',
        data: { participating: false },
      },
    });

    // Both events should have been processed
    const actor1 = mockActorQueue.querySelector('[data-entity-id="actor-1"]');
    expect(actor1).not.toBeNull();
    expect(actor1.getAttribute('data-participating')).toBe('false');
  });

  it('should maintain event queue ordering', () => {
    const eventLog = [];

    // Override handlers to track order
    const originalRoundHandler = subscribedHandlers['core:round_started'];
    const originalTurnHandler = subscribedHandlers['core:turn_started'];

    subscribedHandlers['core:round_started'] = (event) => {
      eventLog.push('round_started');
      return originalRoundHandler(event);
    };

    subscribedHandlers['core:turn_started'] = (event) => {
      eventLog.push('turn_started');
      return originalTurnHandler(event);
    };

    // Fire events
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: { entityId: 'actor-1', roundNumber: 1 },
    });

    // Events should be processed in order
    expect(eventLog).toEqual(['round_started', 'turn_started']);
  });
});

/**
 * Accessibility Tests for Turn Order Ticker
 * Uses jest-axe for automated WCAG compliance testing.
 */
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('TurnOrderTickerRenderer - Integration: Accessibility Compliance', () => {
  let renderer;
  let mockLogger;
  let mockContainer;
  let mockActorQueue;
  let mockRoundNumber;
  let subscribedHandlers;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockLogger = createMockLogger();

    mockActorQueue = document.createElement('div');
    mockActorQueue.id = 'ticker-actor-queue';
    mockActorQueue.scrollTo = jest.fn();

    mockRoundNumber = document.createElement('span');
    mockRoundNumber.id = 'ticker-round-number';

    mockContainer = document.createElement('div');
    mockContainer.id = 'turn-order-ticker';
    mockContainer.setAttribute('role', 'region');
    mockContainer.setAttribute('aria-label', 'Turn order');
    mockContainer.setAttribute('aria-live', 'polite');
    mockContainer.appendChild(mockRoundNumber);
    mockContainer.appendChild(mockActorQueue);
    document.body.appendChild(mockContainer);

    subscribedHandlers = {};

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

  it('should have no WCAG 2.1 AA violations', async () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    const results = await axe(document.body, {
      rules: {
        'color-contrast': { enabled: true },
        'aria-roles': { enabled: true },
        'aria-allowed-attr': { enabled: true },
        'landmark-one-main': { enabled: false }, // Not applicable to component
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA structure on container', () => {
    const ticker = document.querySelector('#turn-order-ticker');

    expect(ticker.getAttribute('role')).toBe('region');
    expect(ticker.getAttribute('aria-label')).toBe('Turn order');
    expect(ticker.getAttribute('aria-live')).toBe('polite');
  });

  it('should have proper ARIA attributes on actor elements', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');

    expect(actorElement.getAttribute('role')).toBe('listitem');
    expect(actorElement.getAttribute('aria-label')).toContain('Actor 1');
    expect(actorElement.getAttribute('aria-label')).toContain('participating');
    expect(actorElement.getAttribute('tabindex')).toBe('0');
  });

  it('should have alt text on portrait images', () => {
    // Re-create renderer with portrait provider
    if (renderer) {
      renderer.dispose();
    }

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
      getEntityPortraitPath: jest.fn(() => '/path/to/portrait.jpg'),
    };

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    const portrait = document.querySelector('.ticker-actor-portrait');
    expect(portrait).not.toBeNull();
    expect(portrait.alt).toBe('Actor 1');
  });

  it('should set aria-disabled for non-participating actors', () => {
    // Set up entity manager to return participating = false
    const mockEntityManager = {
      getEntityInstance: jest.fn(id => ({ id })),
      hasComponent: jest.fn((id, componentId) => componentId === 'core:participation'),
      getComponentData: jest.fn(() => ({ participating: false })),
    };

    const mockDocumentContext = {
      query: jest.fn(selector => document.querySelector(selector)),
      create: jest.fn(tag => document.createElement(tag)),
    };

    const mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        subscribedHandlers[eventType] = handler;
        return jest.fn();
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

    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(id => `Actor ${id.substring(id.lastIndexOf('-') + 1)}`),
      getEntityPortraitPath: jest.fn(() => null),
    };

    if (renderer) {
      renderer.dispose();
    }

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');
    expect(actorElement.getAttribute('aria-disabled')).toBe('true');
    expect(actorElement.getAttribute('aria-label')).toContain('not participating');
  });

  it('should create screen reader announcements for turn changes', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    // Fire turn started event
    subscribedHandlers['core:turn_started']({
      type: 'core:turn_started',
      payload: {
        entityId: 'actor-1',
        entityType: 'player',
      },
    });

    // Check for screen reader announcement element
    const srAnnouncements = document.querySelectorAll('.sr-only[role="status"]');
    expect(srAnnouncements.length).toBeGreaterThan(0);

    // Verify announcement content
    const announcements = Array.from(srAnnouncements).map(el => el.textContent);
    expect(announcements.some(text => text.includes("Actor 1's turn"))).toBe(true);
  });

  it('should announce actor removal to screen readers', async () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1', 'actor-2'],
        strategy: 'sequential',
      },
    });

    // Fire turn ended event
    await subscribedHandlers['core:turn_ended']({
      type: 'core:turn_ended',
      payload: {
        entityId: 'actor-1',
      },
    });

    // Wait a bit for async operations and screen reader announcement to be created
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for screen reader announcement
    const srAnnouncements = document.querySelectorAll('.sr-only[role="status"]');
    const announcements = Array.from(srAnnouncements).map(el => el.textContent);
    expect(announcements.some(text => text.includes('Actor 1 removed from turn order'))).toBe(true);
    expect(announcements.some(text => text.includes('1 actor remaining'))).toBe(true);
  });

  it('should announce participation changes to screen readers', () => {
    subscribedHandlers['core:round_started']({
      type: 'core:round_started',
      payload: {
        roundNumber: 1,
        actors: ['actor-1'],
        strategy: 'sequential',
      },
    });

    // Fire participation changed event
    subscribedHandlers['core:component_added']({
      type: 'core:component_added',
      payload: {
        entityId: 'actor-1',
        componentId: 'core:participation',
        data: { participating: false },
      },
    });

    // Check for screen reader announcement
    const srAnnouncements = document.querySelectorAll('.sr-only[role="status"]');
    const announcements = Array.from(srAnnouncements).map(el => el.textContent);
    expect(announcements.some(text => text.includes('Actor 1 disabled from participation'))).toBe(true);
  });
});
