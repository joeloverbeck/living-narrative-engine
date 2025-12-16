import {
  jest,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import { LocationRenderer } from '../../../../src/domUI/locationRenderer.js';
import * as buildLocationDisplayPayloadModule from '../../../../src/domUI/location/buildLocationDisplayPayload.js';
import { ACTOR_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

const DEFAULT_ACTOR_ID = 'entity:hero';
const DEFAULT_LOCATION_ID = 'location:atrium';

/**
 *
 */
function createMockEventDispatcher() {
  const handlers = new Map();
  return {
    dispatch: jest.fn((eventName, payload) => {
      const callbacks = handlers.get(eventName);
      if (callbacks) {
        callbacks.forEach((handler) => handler({ type: eventName, payload }));
      }
    }),
    subscribe: jest.fn((eventName, handler) => {
      if (!handlers.has(eventName)) {
        handlers.set(eventName, []);
      }
      handlers.get(eventName).push(handler);
      return () => {
        const registered = handlers.get(eventName);
        if (!registered) return;
        const index = registered.indexOf(handler);
        if (index >= 0) {
          registered.splice(index, 1);
        }
      };
    }),
    unsubscribe: jest.fn((eventName, handler) => {
      const registered = handlers.get(eventName);
      if (!registered) return;
      const index = registered.indexOf(handler);
      if (index >= 0) {
        registered.splice(index, 1);
      }
    }),
  };
}

/**
 *
 */
function setupDomContainer() {
  const container = document.createElement('section');
  container.id = 'location-container';

  const nameDisplay = document.createElement('div');
  nameDisplay.id = 'location-name-display';

  const portraitVisuals = document.createElement('div');
  portraitVisuals.id = 'location-portrait-visuals';

  const portraitImage = document.createElement('img');
  portraitImage.id = 'location-portrait-image';
  portraitVisuals.appendChild(portraitImage);

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
 * @param root0.locationDetails
 * @param root0.portraitData
 * @param root0.characterInfoById
 * @param root0.actorId
 * @param root0.locationId
 * @param root0.extraEntities
 */
function setupRenderer({
  testBed,
  locationDetails,
  portraitData,
  characterInfoById,
  actorId = DEFAULT_ACTOR_ID,
  locationId = DEFAULT_LOCATION_ID,
  extraEntities = ['object:statue'],
}) {
  const domElements = setupDomContainer();

  const documentContext = new DocumentContext(document, testBed.logger);
  const domElementFactory = new DomElementFactory(documentContext);
  const safeEventDispatcher = createMockEventDispatcher();

  const entityInstances = {
    [actorId]: {
      hasComponent: jest.fn(
        (componentId) => componentId === ACTOR_COMPONENT_ID
      ),
    },
  };

  Object.keys(characterInfoById).forEach((id) => {
    entityInstances[id] = {
      hasComponent: jest.fn(
        (componentId) => componentId === ACTOR_COMPONENT_ID
      ),
    };
  });

  extraEntities.forEach((id) => {
    entityInstances[id] = {
      hasComponent: jest.fn(() => false),
    };
  });

  const entityIdsInLocation = [
    actorId,
    ...Object.keys(characterInfoById),
    ...extraEntities,
  ];

  const entityManager = {
    getEntitiesInLocation: jest.fn().mockReturnValue(entityIdsInLocation),
    getEntityInstance: jest.fn((id) => entityInstances[id] ?? null),
  };

  const entityDisplayDataProvider = {
    getLocationDetails: jest.fn().mockReturnValue(locationDetails),
    getLocationPortraitData: jest.fn().mockReturnValue(portraitData),
    getEntityLocationId: jest
      .fn()
      .mockImplementation((id) => (id === actorId ? locationId : null)),
    getCharacterDisplayInfo: jest
      .fn()
      .mockImplementation((id) => characterInfoById[id] ?? null),
  };

  const dataRegistry = {
    getAll: jest.fn().mockReturnValue([]),
  };

  const lightingStateService = {
    getLocationLightingState: jest.fn().mockReturnValue({
      isLit: true,
      lightSources: [],
    }),
  };

  const renderer = new LocationRenderer({
    logger: testBed.logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    dataRegistry,
    lightingStateService,
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

describe('Location display payload integration', () => {
  let testBed;
  let buildPayloadSpy;

  beforeEach(() => {
    testBed = createTestBed();
    buildPayloadSpy = jest.spyOn(
      buildLocationDisplayPayloadModule,
      'buildLocationDisplayPayload'
    );
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds payload with gathered characters and fallback portrait alt text', () => {
    const locationDetails = {
      name: 'Atrium of Echoes',
      description: 'A luminous hall filled with soft echoes.',
      exits: [
        { id: 'exit:north', description: 'Northern Hallway' },
        { id: 'exit:south', description: 'Southern Balcony' },
      ],
    };

    const portraitData = {
      imagePath: '/assets/locations/atrium.jpg',
    };

    const characterInfoById = {
      'npc:guide': {
        id: 'npc:guide',
        name: 'The Guide',
        description: 'Offers cryptic hints.',
        portraitPath: '/assets/portraits/guide.png',
      },
      'npc:merchant': {
        id: 'npc:merchant',
        name: 'Traveling Merchant',
        description: 'Sells rare trinkets.',
      },
    };

    const {
      renderer,
      safeEventDispatcher,
      domElements,
      entityDisplayDataProvider,
    } = setupRenderer({
      testBed,
      locationDetails,
      portraitData,
      characterInfoById,
    });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityId: DEFAULT_ACTOR_ID,
      entityType: 'player',
    });

    expect(entityDisplayDataProvider.getLocationDetails).toHaveBeenCalledWith(
      DEFAULT_LOCATION_ID
    );
    expect(buildPayloadSpy).toHaveBeenCalledTimes(1);
    const [detailsArg, portraitArg, charactersArg] =
      buildPayloadSpy.mock.calls[0];
    expect(detailsArg).toBe(locationDetails);
    expect(portraitArg).toBe(portraitData);
    expect(charactersArg).toEqual([
      characterInfoById['npc:guide'],
      characterInfoById['npc:merchant'],
    ]);

    const payload = buildPayloadSpy.mock.results[0].value;
    expect(payload).toEqual({
      name: locationDetails.name,
      description: locationDetails.description,
      portraitPath: portraitData.imagePath,
      portraitAltText: `Image of ${locationDetails.name}`,
      exits: locationDetails.exits,
      characters: charactersArg,
    });

    const portraitImage = domElements.portraitImage;
    expect(portraitImage.src).toContain(portraitData.imagePath);
    expect(portraitImage.alt).toBe(`Image of ${locationDetails.name}`);

    const characterItems = domElements.charactersDisplay.querySelectorAll('li');
    expect(characterItems).toHaveLength(2);
    expect(characterItems[0].textContent).toContain('The Guide');
    expect(characterItems[1].textContent).toContain('Traveling Merchant');

    const dispatchedEvents = safeEventDispatcher.dispatch.mock.calls;
    const errorEvents = dispatchedEvents.filter(
      ([eventName]) => eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).toHaveLength(0);

    renderer.dispose();
    domElements.container.remove();
  });

  it('uses provided portrait alt text when available', () => {
    const locationDetails = {
      name: 'Observatory Apex',
      description: 'The highest point overlooking the stars.',
      exits: [{ id: 'exit:spiral', description: 'Spiral Staircase' }],
    };

    const portraitData = {
      imagePath: '/assets/locations/observatory.jpg',
      altText: 'Observatory dome at twilight',
    };

    const characterInfoById = {
      'npc:astronomer': {
        id: 'npc:astronomer',
        name: 'Resident Astronomer',
        description: 'Charts the night sky.',
      },
    };

    const { renderer, safeEventDispatcher, domElements } = setupRenderer({
      testBed,
      locationDetails,
      portraitData,
      characterInfoById,
    });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityId: DEFAULT_ACTOR_ID,
      entityType: 'player',
    });

    expect(buildPayloadSpy).toHaveBeenCalledTimes(1);
    const payload = buildPayloadSpy.mock.results[0].value;
    expect(payload.portraitAltText).toBe(portraitData.altText);

    const portraitImage = domElements.portraitImage;
    expect(portraitImage.alt).toBe(portraitData.altText);

    renderer.dispose();
    domElements.container.remove();
  });

  it('gracefully handles locations without portrait data', () => {
    const locationDetails = {
      name: 'Silent Archives',
      description: 'Shelves of forgotten tomes.',
      exits: [{ id: 'exit:west', description: 'Hall of Whispers' }],
    };

    const characterInfoById = {
      'npc:librarian': {
        id: 'npc:librarian',
        name: 'Head Librarian',
        description: 'Maintains absolute silence.',
      },
    };

    const {
      renderer,
      safeEventDispatcher,
      domElements,
      entityDisplayDataProvider,
    } = setupRenderer({
      testBed,
      locationDetails,
      portraitData: null,
      characterInfoById,
    });

    safeEventDispatcher.dispatch('core:turn_started', {
      entityId: DEFAULT_ACTOR_ID,
      entityType: 'player',
    });

    expect(entityDisplayDataProvider.getLocationDetails).toHaveBeenCalledWith(
      DEFAULT_LOCATION_ID
    );
    expect(buildPayloadSpy).toHaveBeenCalledTimes(1);
    const payload = buildPayloadSpy.mock.results[0].value;
    expect(payload.portraitPath).toBeNull();
    expect(payload.portraitAltText).toBeNull();

    const portraitImage = domElements.portraitImage;
    expect(portraitImage.style.display).toBe('none');
    expect(portraitImage.getAttribute('src')).toBe('');

    const portraitVisuals = domElements.portraitVisuals;
    expect(portraitVisuals.style.display).toBe('none');

    renderer.dispose();
    domElements.container.remove();
  });
});
