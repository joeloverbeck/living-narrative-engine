import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import { LocationRenderer } from '../../../../src/domUI/locationRenderer.js';
import { renderLocationLists } from '../../../../src/domUI/location/renderLocationLists.js';
import { ACTOR_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

/**
 *
 */
function createMockEventDispatcher() {
  const handlers = new Map();
  return {
    dispatch: jest.fn((eventName, payload) => {
      const callbacks = handlers.get(eventName);
      if (!callbacks) return;
      callbacks.forEach((handler) => handler({ type: eventName, payload }));
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
    charactersDisplay,
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
 */
function createRenderer({ testBed }) {
  const domElements = setupDomContainer();

  const documentContext = new DocumentContext(document, testBed.logger);
  const domElementFactory = new DomElementFactory(documentContext);
  const safeEventDispatcher = createMockEventDispatcher();

  const entityManager = {
    getEntitiesInLocation: jest.fn().mockReturnValue(['entity:hero']),
    getEntityInstance: jest.fn().mockImplementation((id) => ({
      hasComponent: (componentId) => componentId === ACTOR_COMPONENT_ID,
    })),
  };

  const entityDisplayDataProvider = {
    getLocationDetails: jest.fn().mockReturnValue({
      name: 'Test Location',
      description: 'A place used for verifying rendering.',
      exits: [],
    }),
    getLocationPortraitData: jest.fn().mockReturnValue({
      imagePath: '/assets/locations/test.png',
    }),
    getEntityLocationId: jest.fn().mockReturnValue('location:test'),
    getCharacterDisplayInfo: jest.fn().mockReturnValue(null),
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
    domElements,
  };
}

describe('renderLocationLists integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders exits and characters using the renderer list helpers', () => {
    const { renderer, domElements } = createRenderer({ testBed });

    const locationDto = {
      exits: [
        { id: 'exit:north', description: 'Northern Hallway' },
        { id: 'exit:broken', label: 'Hidden Doorway' },
      ],
      characters: [
        {
          id: 'npc:guide',
          name: 'The Guide',
          description: 'Offers cryptic hints.',
          portraitPath: '/assets/portraits/guide.png',
        },
        {
          id: 'npc:merchant',
          name: 'Traveling Merchant',
        },
      ],
    };

    renderLocationLists(renderer, locationDto);

    const exitItems = domElements.exitsDisplay.querySelectorAll('li');
    expect(exitItems).toHaveLength(2);
    expect(exitItems[0].textContent).toContain('Northern Hallway');
    expect(exitItems[1].textContent).toContain('(Invalid description)');

    const characterItems = domElements.charactersDisplay.querySelectorAll('li');
    expect(characterItems).toHaveLength(2);

    const [guideItem, merchantItem] = characterItems;
    const guideImage = guideItem.querySelector('img.character-portrait');
    expect(guideImage).not.toBeNull();
    expect(guideImage?.alt).toBe('Portrait of The Guide');

    const tooltip = guideItem.querySelector('span.character-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.innerHTML).toContain('Offers cryptic hints.');

    guideItem.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(guideItem.classList.contains('tooltip-open')).toBe(true);

    expect(merchantItem.querySelector('span.character-tooltip')).toBeNull();
  });

  it('renders empty state messages when no exits or characters are present', () => {
    const { renderer, domElements } = createRenderer({ testBed });

    renderLocationLists(renderer, {
      exits: null,
      characters: [],
    });

    expect(domElements.exitsDisplay.textContent).toContain('(None visible)');
    expect(domElements.charactersDisplay.textContent).toContain(
      '(None else here)',
    );
  });
});
