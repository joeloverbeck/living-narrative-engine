import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderTickerRenderer } from '../../../src/domUI/turnOrderTickerRenderer.js';

describe('TurnOrderTickerRenderer - Participation Updates', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let queueElement;

  beforeEach(() => {
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

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponent: jest.fn(),
      hasComponent: jest.fn(() => false),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn((id) => `Actor ${id}`),
      getEntityPortraitPath: jest.fn(() => null),
    };

    mockContainer = document.createElement('div');
    queueElement = document.createElement('div');
    queueElement.id = 'ticker-actor-queue';
    queueElement.scrollTo = jest.fn(); // Add scrollTo mock for jsdom
    mockContainer.innerHTML = `<span id="ticker-round-number">ROUND 1</span>`;
    mockContainer.appendChild(queueElement);

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: (selector) => mockContainer.querySelector(selector),
        create: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        create: jest.fn((tag) => document.createElement(tag)),
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
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Render actors
    renderer.render([
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ]);
  });

  it('should set data-participating to false for non-participating actors', () => {
    renderer.updateActorParticipation('actor-2', false);

    const actor2 = queueElement.querySelector('[data-entity-id="actor-2"]');
    expect(actor2.getAttribute('data-participating')).toBe('false');
  });

  it('should set data-participating to true for participating actors', () => {
    // First set to false
    renderer.updateActorParticipation('actor-1', false);
    // Then set back to true
    renderer.updateActorParticipation('actor-1', true);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.getAttribute('data-participating')).toBe('true');
  });

  it('should validate entity ID parameter', () => {
    renderer.updateActorParticipation(null, false);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateActorParticipation(undefined, false);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateActorParticipation(123, false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should validate participating parameter', () => {
    renderer.updateActorParticipation('actor-1', 'not-a-boolean');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateActorParticipation requires a boolean participating value',
      expect.any(Object)
    );

    renderer.updateActorParticipation('actor-1', null);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle actor not found gracefully', () => {
    renderer.updateActorParticipation('non-existent-actor', false);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.objectContaining({
        entityId: 'non-existent-actor',
        reason: 'May not be in current round or already removed',
      })
    );
  });

  it('should add and remove transition class', async () => {
    renderer.updateActorParticipation('actor-1', false);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.classList.contains('participation-updating')).toBe(true);

    // Check after transition duration
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(actor1.classList.contains('participation-updating')).toBe(false);
  });

  it('should handle multiple updates to same actor', () => {
    renderer.updateActorParticipation('actor-1', false);
    renderer.updateActorParticipation('actor-1', true);
    renderer.updateActorParticipation('actor-1', false);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.getAttribute('data-participating')).toBe('false');
  });

  it('should update multiple actors independently', () => {
    renderer.updateActorParticipation('actor-1', false);
    renderer.updateActorParticipation('actor-2', false);
    renderer.updateActorParticipation('actor-3', true); // Keep participating

    expect(queueElement.querySelector('[data-entity-id="actor-1"]').getAttribute('data-participating')).toBe('false');
    expect(queueElement.querySelector('[data-entity-id="actor-2"]').getAttribute('data-participating')).toBe('false');
    expect(queueElement.querySelector('[data-entity-id="actor-3"]').getAttribute('data-participating')).toBe('true');
  });

  it('should not crash if queue is empty', () => {
    // Clear queue
    while (queueElement.firstChild) {
      queueElement.removeChild(queueElement.firstChild);
    }

    expect(() => {
      renderer.updateActorParticipation('actor-1', false);
    }).not.toThrow();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.any(Object)
    );
  });
});
