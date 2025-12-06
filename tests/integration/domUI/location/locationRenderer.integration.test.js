import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import { LocationRenderer } from '../../../../src/domUI/locationRenderer.js';
import { LocationNotFoundError } from '../../../../src/errors/locationNotFoundError.js';
import { DEFAULT_LOCATION_NAME } from '../../../../src/domUI/uiDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

/**
 *
 */
function createMockEventDispatcher() {
  const handlers = new Map();
  return {
    dispatch: jest.fn((eventName, payload) => {
      const callbacks = handlers.get(eventName);
      if (!callbacks) {
        return;
      }
      callbacks.forEach((handler) => handler({ type: eventName, payload }));
    }),
    subscribe: jest.fn((eventName, handler) => {
      if (!handlers.has(eventName)) {
        handlers.set(eventName, []);
      }
      handlers.get(eventName).push(handler);
      return () => {
        const registered = handlers.get(eventName);
        if (!registered) {
          return;
        }
        const index = registered.indexOf(handler);
        if (index >= 0) {
          registered.splice(index, 1);
        }
      };
    }),
    unsubscribe: jest.fn((eventName, handler) => {
      const registered = handlers.get(eventName);
      if (!registered) {
        return;
      }
      const index = registered.indexOf(handler);
      if (index >= 0) {
        registered.splice(index, 1);
      }
    }),
  };
}

/**
 *
 * @param root0
 * @param root0.includePortraitImage
 */
function setupDomContainer({ includePortraitImage = true } = {}) {
  const container = document.createElement('section');
  container.id = 'location-container';

  const nameDisplay = document.createElement('div');
  nameDisplay.id = 'location-name-display';

  const portraitVisuals = document.createElement('div');
  portraitVisuals.id = 'location-portrait-visuals';

  let portraitImage = null;
  if (includePortraitImage) {
    portraitImage = document.createElement('img');
    portraitImage.id = 'location-portrait-image';
    portraitVisuals.appendChild(portraitImage);
  }

  const descriptionDisplay = document.createElement('div');
  descriptionDisplay.id = 'location-description-display';

  const exitsDisplay = document.createElement('div');
  exitsDisplay.id = 'location-exits-display';

  const charactersDisplay = document.createElement('div');
  charactersDisplay.id = 'location-characters-display';

  container.append(
    nameDisplay,
    portraitVisuals,
    descriptionDisplay,
    exitsDisplay,
    charactersDisplay
  );

  document.body.appendChild(container);

  return {
    container,
    nameDisplay,
    portraitVisuals,
    portraitImage,
    descriptionDisplay,
    exitsDisplay,
    charactersDisplay,
  };
}

/**
 *
 * @param root0
 * @param root0.testBed
 * @param root0.includePortraitImage
 * @param root0.entityManagerOverrides
 * @param root0.entityDisplayOverrides
 */
function createRenderer({
  testBed,
  includePortraitImage = true,
  entityManagerOverrides = {},
  entityDisplayOverrides = {},
} = {}) {
  const domElements = setupDomContainer({ includePortraitImage });

  const documentContext = new DocumentContext(document, testBed.logger);
  const domElementFactory = new DomElementFactory(documentContext);
  const safeEventDispatcher = createMockEventDispatcher();

  const entityManager = {
    getEntitiesInLocation: jest
      .fn()
      .mockReturnValue(['entity:hero', 'npc:ally']),
    getEntityInstance: jest.fn((entityId) => {
      if (entityId === 'npc:ally') {
        return {
          hasComponent: jest.fn().mockReturnValue(true),
        };
      }
      return {
        hasComponent: jest.fn().mockReturnValue(true),
      };
    }),
    ...entityManagerOverrides,
  };

  const entityDisplayDataProvider = {
    getLocationDetails: jest.fn().mockReturnValue({
      name: 'Default Location',
      description: 'Default description',
      exits: [],
    }),
    getLocationPortraitData: jest.fn().mockReturnValue({
      imagePath: '/assets/locations/default.png',
      altText: 'Default Location portrait',
    }),
    getEntityLocationId: jest.fn().mockReturnValue('location:default'),
    getCharacterDisplayInfo: jest.fn().mockImplementation((id) =>
      id === 'npc:ally'
        ? {
            id,
            name: 'Helpful Ally',
            description: 'Offers advice.',
          }
        : null
    ),
    ...entityDisplayOverrides,
  };

  const dataRegistry = {
    getAll: jest.fn().mockReturnValue([]),
  };

  const renderer = new LocationRenderer({
    logger: testBed.logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    dataRegistry,
    containerElement: domElements.container,
  });

  return {
    renderer,
    safeEventDispatcher,
    domElements,
    entityManager,
    entityDisplayDataProvider,
  };
}

describe('LocationRenderer integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clears the display with defaults when turn started lacks an entity id', () => {
    const { safeEventDispatcher, domElements } = createRenderer({ testBed });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityType: 'player',
    });

    const nameMessage =
      domElements.nameDisplay.querySelector('p.error-message');
    expect(nameMessage?.textContent).toBe(`(${DEFAULT_LOCATION_NAME})`);

    const descriptionMessage =
      domElements.descriptionDisplay.querySelector('p.error-message');
    expect(descriptionMessage?.textContent).toBe(
      'No entity specified for turn.'
    );

    const exitsMessage =
      domElements.exitsDisplay.querySelector('p.error-message');
    expect(exitsMessage?.textContent).toBe('(Exits Unavailable)');

    const charactersMessage =
      domElements.charactersDisplay.querySelector('p.error-message');
    expect(charactersMessage?.textContent).toBe('(Characters Unavailable)');

    expect(domElements.portraitVisuals.style.display).toBe('none');
    expect(domElements.portraitImage?.style.display).toBe('none');
    expect(domElements.portraitImage?.getAttribute('src')).toBe('');

    const errorEvents = safeEventDispatcher.dispatch.mock.calls.filter(
      ([eventName]) => eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).toHaveLength(0);
  });

  it('dispatches a system error when the actor location cannot be resolved', () => {
    const { safeEventDispatcher, domElements } = createRenderer({
      testBed,
      entityDisplayOverrides: {
        getEntityLocationId: jest.fn().mockReturnValue(null),
      },
    });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityId: 'entity:hero',
      entityType: 'player',
    });

    const errorEvents = safeEventDispatcher.dispatch.mock.calls.filter(
      ([eventName]) => eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).toHaveLength(1);
    const [, payload] = errorEvents[0];
    expect(payload.message).toContain(
      "Entity 'entity:hero' has no valid position"
    );

    const descriptionMessage =
      domElements.descriptionDisplay.querySelector('p.error-message');
    expect(descriptionMessage?.textContent).toBe(
      'Location for entity:hero is unknown.'
    );

    expect(domElements.portraitVisuals.style.display).toBe('none');
    expect(domElements.portraitImage?.style.display).toBe('none');
    expect(domElements.portraitImage?.getAttribute('alt')).toBe('');
  });

  it('reports missing location details when the data provider throws', () => {
    const missingLocationId = 'location:missing';
    const { safeEventDispatcher, domElements } = createRenderer({
      testBed,
      entityDisplayOverrides: {
        getEntityLocationId: jest.fn().mockReturnValue(missingLocationId),
        getLocationDetails: jest.fn().mockImplementation(() => {
          throw new LocationNotFoundError(missingLocationId);
        }),
      },
      entityManagerOverrides: {
        getEntitiesInLocation: jest.fn().mockReturnValue(['entity:hero']),
      },
    });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityId: 'entity:hero',
      entityType: 'player',
    });

    const errorEvents = safeEventDispatcher.dispatch.mock.calls.filter(
      ([eventName]) => eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).toHaveLength(1);
    const [, payload] = errorEvents[0];
    expect(payload.message).toContain(
      `Location details for ID '${missingLocationId}' not found.`
    );

    const descriptionMessage =
      domElements.descriptionDisplay.querySelector('p.error-message');
    expect(descriptionMessage?.textContent).toBe(
      `Location data for '${missingLocationId}' missing.`
    );
  });

  it('warns about missing portrait elements and aborts rendering when required nodes are absent', () => {
    const { renderer, safeEventDispatcher } = createRenderer({
      testBed,
      includePortraitImage: false,
    });

    renderer.render({
      name: 'Inaccessible Archive',
      description: 'Shelves sealed behind ancient wards.',
      exits: [],
      characters: [],
    });

    const portraitSetupError = safeEventDispatcher.dispatch.mock.calls.find(
      ([eventName, payload]) =>
        eventName === SYSTEM_ERROR_OCCURRED_ID &&
        payload.message.includes('Location portrait DOM elements not bound')
    );
    expect(portraitSetupError).toBeDefined();

    const renderAbortError = safeEventDispatcher.dispatch.mock.calls.find(
      ([eventName, payload]) =>
        eventName === SYSTEM_ERROR_OCCURRED_ID &&
        payload.message.includes(
          "Cannot render, required DOM element 'locationPortraitImageElement' is missing."
        )
    );
    expect(renderAbortError).toBeDefined();
  });

  it('clears the display when render is invoked without a payload', () => {
    const { renderer, safeEventDispatcher, domElements } = createRenderer({
      testBed,
    });

    renderer.render(null);

    const nameMessage =
      domElements.nameDisplay.querySelector('p.error-message');
    expect(nameMessage?.textContent).toBe(`(${DEFAULT_LOCATION_NAME})`);

    const descriptionMessage =
      domElements.descriptionDisplay.querySelector('p.error-message');
    expect(descriptionMessage?.textContent).toBe(
      '(No location data to display)'
    );

    const exitsMessage =
      domElements.exitsDisplay.querySelector('p.error-message');
    expect(exitsMessage?.textContent).toBe('(Exits Unavailable)');

    const charactersMessage =
      domElements.charactersDisplay.querySelector('p.error-message');
    expect(charactersMessage?.textContent).toBe('(Characters Unavailable)');

    expect(domElements.portraitVisuals.style.display).toBe('none');
    expect(domElements.portraitImage?.style.display).toBe('none');

    const errorEvents = safeEventDispatcher.dispatch.mock.calls.filter(
      ([eventName]) => eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).toHaveLength(0);
  });
});
