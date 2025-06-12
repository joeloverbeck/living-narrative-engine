/**
 * @file Unit tests for the CurrentTurnActorRenderer class.
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { CurrentTurnActorRenderer } from '../../src/domUI/currentTurnActorRenderer.js';
import { TURN_STARTED_ID } from '../../src/constants/eventIds.js';

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
});
