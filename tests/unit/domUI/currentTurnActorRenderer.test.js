/**
 * @file Unit tests for the CurrentTurnActorRenderer class.
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { CurrentTurnActorRenderer } from '../../../src/domUI/currentTurnActorRenderer.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockDocumentContext = () => ({
  query: jest.fn((sel) => document.querySelector(sel)),
  create: jest.fn((tag) => document.createElement(tag)),
});

const createMockVed = () => ({
  subscribe: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
});

const createMockEddp = () => ({
  getEntityName: jest.fn(),
  getEntityPortraitPath: jest.fn(),
});

describe('CurrentTurnActorRenderer', () => {
  let container;
  let visuals;
  let img;
  let nameEl;
  let deps;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="current-turn-actor-panel">
        <div class="actor-visuals"></div>
        <img id="current-actor-image" />
        <div class="actor-name-display"></div>
      </div>
    `;
    container = document.getElementById('current-turn-actor-panel');
    visuals = container.querySelector('.actor-visuals');
    img = container.querySelector('#current-actor-image');
    nameEl = container.querySelector('.actor-name-display');

    deps = {
      logger: createMockLogger(),
      documentContext: createMockDocumentContext(),
      validatedEventDispatcher: createMockVed(),
      _entityManager: {},
      entityDisplayDataProvider: createMockEddp(),
    };
  });

  it('constructs and subscribes to events', () => {
    const renderer = new CurrentTurnActorRenderer(deps);
    expect(deps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      TURN_STARTED_ID,
      expect.any(Function)
    );
    expect(renderer.elements.actorNameElement).toBe(nameEl);
  });

  it('throws when entityDisplayDataProvider is missing', () => {
    deps.entityDisplayDataProvider = null;
    expect(() => new CurrentTurnActorRenderer(deps)).toThrow(
      '[CurrentTurnActorRenderer] EntityDisplayDataProvider dependency is missing.'
    );
  });

  it('resets panel when event payload is invalid', () => {
    const renderer = new CurrentTurnActorRenderer(deps);
    nameEl.textContent = 'Prev';
    visuals.style.display = 'block';
    img.style.display = 'block';
    renderer.handleTurnStarted({ payload: {} });
    expect(nameEl.textContent).toBe('N/A');
    expect(visuals.style.display).toBe('none');
    expect(img.style.display).toBe('none');
  });

  it('updates panel with actor info when event is valid', () => {
    deps.entityDisplayDataProvider.getEntityName.mockReturnValue('Hero');
    deps.entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
      '/p.png'
    );
    const renderer = new CurrentTurnActorRenderer(deps);
    renderer.handleTurnStarted({ payload: { entityId: 'hero1' } });
    expect(nameEl.textContent).toBe('Hero');
    expect(img.src).toContain('/p.png');
    expect(img.alt).toBe('Portrait of Hero');
    expect(visuals.style.display).toBe('flex');
    expect(img.style.display).toBe('block');
  });

  it('hides portrait when provider returns null', () => {
    deps.entityDisplayDataProvider.getEntityName.mockReturnValue('Hero');
    deps.entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    const renderer = new CurrentTurnActorRenderer(deps);
    renderer.handleTurnStarted({ payload: { entityId: 'hero1' } });
    expect(visuals.style.display).toBe('none');
    expect(img.style.display).toBe('none');
    expect(img.getAttribute('src')).toBe('');
  });

  it('logs error when DOM elements are not bound correctly', () => {
    // Simulate BoundDomRendererBase failing to bind some elements
    // by removing elements after documentContext.query is called
    const originalQuery = deps.documentContext.query;
    deps.documentContext.query = jest.fn((selector) => {
      const element = originalQuery(selector);
      // Simulate partial binding failure
      if (selector === '#current-turn-actor-panel .actor-visuals') {
        return null; // This will cause elements.actorVisualsElement to be null
      }
      return element;
    });

    const renderer = new CurrentTurnActorRenderer(deps);

    // Verify error was logged
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CurrentTurnActorRenderer] One or more required DOM elements not bound'
      )
    );
  });

  it('logs error when subscription to TURN_STARTED_ID fails', () => {
    // Mock subscribe to throw an error
    deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
      throw new Error('Subscription failed');
    });

    // Creating renderer should catch the error and log it
    new CurrentTurnActorRenderer(deps);

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `[CurrentTurnActorRenderer] Failed to subscribe to ${TURN_STARTED_ID}`
      ),
      expect.any(Error)
    );
  });

  it('logs warning when DOM elements are missing during update', () => {
    deps.entityDisplayDataProvider.getEntityName.mockReturnValue('Hero');
    deps.entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
      '/portrait.png'
    );

    const renderer = new CurrentTurnActorRenderer(deps);

    // Simulate elements becoming null after construction
    renderer.elements.actorVisualsElement = null;

    // Call handleTurnStarted which will call #updateActorInfo
    renderer.handleTurnStarted({ payload: { entityId: 'hero1' } });

    // Verify warning was logged
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CurrentTurnActorRenderer] DOM elements not available for update'
      )
    );
  });

  it('logs debug when DOM elements are missing during reset', () => {
    // Create renderer with missing elements by mocking documentContext
    const originalQuery = deps.documentContext.query;
    deps.documentContext.query = jest.fn((selector) => {
      // Return null for all elements to trigger the reset panel debug log
      return null;
    });

    // This will trigger #resetPanel in constructor, which will log debug message
    new CurrentTurnActorRenderer(deps);

    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CurrentTurnActorRenderer] Cannot reset panel: one or more DOM elements from this.elements are null'
      )
    );

    // Restore original query
    deps.documentContext.query = originalQuery;
  });

  it('handles null event payload correctly', () => {
    const renderer = new CurrentTurnActorRenderer(deps);
    renderer.handleTurnStarted({ payload: null });

    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Expected entityId string in .payload.entityId was missing or invalid'
      ),
      expect.objectContaining({ receivedData: { payload: null } })
    );
    expect(nameEl.textContent).toBe('N/A');
  });

  it('handles empty entityId correctly', () => {
    const renderer = new CurrentTurnActorRenderer(deps);
    renderer.handleTurnStarted({ payload: { entityId: '' } });

    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Expected entityId string in .payload.entityId was missing or invalid'
      ),
      expect.objectContaining({ receivedData: { payload: { entityId: '' } } })
    );
  });

  it('sets correct alt text when actor name is DEFAULT_ACTOR_NAME', () => {
    deps.entityDisplayDataProvider.getEntityName.mockReturnValue('N/A');
    deps.entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
      '/portrait.png'
    );

    const renderer = new CurrentTurnActorRenderer(deps);
    renderer.handleTurnStarted({ payload: { entityId: 'unknown' } });

    expect(img.alt).toBe('Current Actor Portrait'); // Should use default alt text
    expect(nameEl.textContent).toBe('N/A');
  });

  it('disposes properly and clears elements', () => {
    const renderer = new CurrentTurnActorRenderer(deps);

    // Verify elements are bound initially
    expect(renderer.elements.actorNameElement).toBe(nameEl);
    expect(renderer.elements.actorImageElement).toBe(img);
    expect(renderer.elements.actorVisualsElement).toBe(visuals);

    // Call dispose
    renderer.dispose();

    // Verify elements are cleared
    expect(renderer.elements).toEqual({});
    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CurrentTurnActorRenderer] Bound DOM elements cleared'
      )
    );
  });
});
