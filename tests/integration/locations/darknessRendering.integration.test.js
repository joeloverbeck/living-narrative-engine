// tests/integration/locations/darknessRendering.integration.test.js
/**
 * @file Integration tests for darkness rendering in LocationRenderer.
 * Tests the complete flow from lighting state detection to UI rendering.
 * @jest-environment jsdom
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { LocationRenderer } from '../../../src/domUI';
import {
  PRESENCE_MESSAGES,
  getPresenceMessage,
} from '../../../src/domUI/location/presenceMessageBuilder.js';
import {
  buildDarknessPayload,
  DEFAULT_DARKNESS_DESCRIPTION,
} from '../../../src/domUI/location/buildDarknessPayload.js';

// Mock component ID
jest.mock('../../../src/constants/componentIds.js', () => ({
  POSITION_COMPONENT_ID: 'test:position',
  NAME_COMPONENT_ID: 'test:name',
  DESCRIPTION_COMPONENT_ID: 'test:description',
  EXITS_COMPONENT_ID: 'test:exits',
  ACTOR_COMPONENT_ID: 'test:actor',
}));

import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Darkness Rendering Integration', () => {
  // Mock dependencies
  let mockLogger;
  let mockDocumentContext;
  let mockSafeEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockDataRegistry;
  let mockLightingStateService;
  let mockContainerElement;

  // DOM elements
  let mockNameDisplay;
  let mockDescriptionDisplay;
  let mockExitsDisplay;
  let mockCharactersDisplay;
  let mockPortraitVisualsElement;
  let mockPortraitImageElement;

  let rendererDeps;
  let turnStartedCallback;

  const MOCK_PLAYER_ID = 'player:1';
  const MOCK_LOCATION_ID = 'instance:dark_cave';

  const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  const createMockDocumentContext = () => {
    const mockDocument = {
      createElement: jest.fn((tagName) => {
        const el = document.createElement(tagName);
        jest.spyOn(el, 'appendChild');
        return el;
      }),
      createTextNode: jest.fn((text) => document.createTextNode(text)),
      querySelector: jest.fn(),
    };
    return {
      document: mockDocument,
      query: jest.fn(),
      create: jest.fn((tagName, className, textContent) => {
        const el = mockDocument.createElement(tagName);
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
      }),
    };
  };

  const createMockVed = () => ({
    subscribe: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
    unsubscribe: jest.fn(),
  });

  const createMockDomElementFactory = (docContext) => ({
    create: jest.fn((tagName, options) => {
      const el = docContext.document.createElement(tagName);
      if (options?.cls) {
        if (Array.isArray(options.cls)) el.classList.add(...options.cls);
        else el.className = options.cls;
      }
      if (options?.text) el.textContent = options.text;
      if (options?.id) el.id = options.id;
      return el;
    }),
    p: jest.fn((className, textContent) => {
      const el = docContext.document.createElement('p');
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }),
    h3: jest.fn((className, textContent) => {
      const el = docContext.document.createElement('h3');
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }),
    h4: jest.fn((className, textContent) => {
      const el = docContext.document.createElement('h4');
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }),
    ul: jest.fn((id, cls) => {
      const el = docContext.document.createElement('ul');
      if (id) el.id = id;
      if (cls) {
        if (Array.isArray(cls)) el.classList.add(...cls);
        else el.className = cls;
      }
      return el;
    }),
    li: jest.fn((cls, text) => {
      const el = docContext.document.createElement('li');
      if (cls) {
        if (Array.isArray(cls)) el.classList.add(...cls);
        else el.className = cls;
      }
      if (text) el.textContent = text;
      return el;
    }),
    span: jest.fn((cls, text) => {
      const el = docContext.document.createElement('span');
      if (cls) {
        if (Array.isArray(cls)) el.classList.add(...cls);
        else el.className = cls;
      }
      if (text) el.textContent = text;
      return el;
    }),
  });

  const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
    getComponentData: jest.fn(() => null),
  });

  const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
  });

  const createMockEntityDisplayDataProvider = () => ({
    getEntityLocationId: jest.fn(),
    getLocationDetails: jest.fn(),
    getCharacterDisplayInfo: jest.fn(),
    getEntityName: jest.fn(),
    getEntityPortraitPath: jest.fn(),
    getLocationPortraitData: jest.fn(),
  });

  const createMockLightingStateService = () => ({
    getLocationLightingState: jest.fn(() => ({ isLit: true, lightSources: [] })),
    isLocationLit: jest.fn(() => true),
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDocumentContext = createMockDocumentContext();
    mockSafeEventDispatcher = createMockVed();
    mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
    mockEntityManager = createMockEntityManager();
    mockEntityDisplayDataProvider = createMockEntityDisplayDataProvider();
    mockDataRegistry = createMockDataRegistry();
    mockLightingStateService = createMockLightingStateService();

    // Set up DOM container
    mockContainerElement = document.createElement('div');
    mockContainerElement.id = 'location-info-container';

    mockNameDisplay = document.createElement('div');
    mockNameDisplay.id = 'location-name-display';
    mockDescriptionDisplay = document.createElement('div');
    mockDescriptionDisplay.id = 'location-description-display';
    mockExitsDisplay = document.createElement('div');
    mockExitsDisplay.id = 'location-exits-display';
    mockCharactersDisplay = document.createElement('div');
    mockCharactersDisplay.id = 'location-characters-display';
    mockPortraitVisualsElement = document.createElement('div');
    mockPortraitVisualsElement.id = 'location-portrait-visuals';
    mockPortraitImageElement = document.createElement('img');
    mockPortraitImageElement.id = 'location-portrait-image';

    document.body.appendChild(mockContainerElement);
    mockContainerElement.appendChild(mockNameDisplay);
    mockContainerElement.appendChild(mockPortraitVisualsElement);
    mockPortraitVisualsElement.appendChild(mockPortraitImageElement);
    mockContainerElement.appendChild(mockDescriptionDisplay);
    mockContainerElement.appendChild(mockExitsDisplay);
    mockContainerElement.appendChild(mockCharactersDisplay);

    mockDocumentContext.query.mockImplementation((selector) => {
      const selectors = {
        '#location-name-display': mockNameDisplay,
        '#location-description-display': mockDescriptionDisplay,
        '#location-exits-display': mockExitsDisplay,
        '#location-characters-display': mockCharactersDisplay,
        '#location-portrait-visuals': mockPortraitVisualsElement,
        '#location-portrait-image': mockPortraitImageElement,
      };
      return selectors[selector] || document.querySelector(selector);
    });

    // Default mock setups
    mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(
      MOCK_LOCATION_ID
    );
    mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
      name: 'Dark Cave',
      description: 'A damp, dark cave.',
      exits: [{ id: 'exit:1', description: 'North', target: 'loc:2' }],
    });
    mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue({
      imagePath: '/portraits/cave.png',
      altText: 'A dark cave entrance',
    });

    rendererDeps = {
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      dataRegistry: mockDataRegistry,
      containerElement: mockContainerElement,
      lightingStateService: mockLightingStateService,
    };

    turnStartedCallback = undefined;
    mockSafeEventDispatcher.subscribe.mockImplementation(
      (eventType, callback) => {
        if (eventType === 'core:turn_started') {
          turnStartedCallback = callback;
        }
        return jest.fn();
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Complete darkness rendering flow', () => {
    it('should render darkness UI when location is not lit', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      const renderer = new LocationRenderer(rendererDeps);
      const event = {
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      };
      turnStartedCallback(event);

      // Verify lighting service was called with correct location
      expect(
        mockLightingStateService.getLocationLightingState
      ).toHaveBeenCalledWith(MOCK_LOCATION_ID);

      // Verify portrait is hidden
      expect(mockPortraitVisualsElement.style.display).toBe('none');

      // Verify exits section shows empty
      expect(mockExitsDisplay.querySelector('li')).toBeNull();

      // Verify characters section shows empty
      expect(mockCharactersDisplay.querySelector('li')).toBeNull();
    });

    it('should render normal UI when location is lit', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: true,
        lightSources: ['torch'],
      });

      const renderer = new LocationRenderer(rendererDeps);
      const event = {
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      };
      turnStartedCallback(event);

      // Verify portrait is visible
      expect(mockPortraitVisualsElement.style.display).not.toBe('none');

      // Verify location name is rendered
      expect(mockNameDisplay.textContent).toContain('Dark Cave');
    });
  });

  describe('Presence message integration', () => {
    it('should display correct presence message for varying actor counts', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      const testCases = [
        { count: 0, expectedMessage: PRESENCE_MESSAGES.NONE },
        { count: 1, expectedMessage: PRESENCE_MESSAGES.ONE },
        { count: 2, expectedMessage: PRESENCE_MESSAGES.FEW },
        { count: 3, expectedMessage: PRESENCE_MESSAGES.FEW },
        { count: 4, expectedMessage: PRESENCE_MESSAGES.SEVERAL },
        { count: 10, expectedMessage: PRESENCE_MESSAGES.SEVERAL },
      ];

      testCases.forEach(({ count, expectedMessage }) => {
        expect(getPresenceMessage(count)).toBe(expectedMessage);
      });
    });

    it('should render presence message in darkness mode', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      // Set up 2 other actors (FEW)
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([MOCK_PLAYER_ID, 'npc:1', 'npc:2'])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === MOCK_PLAYER_ID) {
          return { id, hasComponent: () => false };
        }
        return { id, hasComponent: (c) => c === ACTOR_COMPONENT_ID };
      });
      mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
        (id) => ({
          id,
          name: `NPC ${id}`,
          description: 'An NPC',
          portraitPath: null,
        })
      );

      const renderer = new LocationRenderer(rendererDeps);
      const event = {
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      };
      turnStartedCallback(event);

      // Verify presence message element exists
      const presenceElement =
        mockDescriptionDisplay.querySelector('.darkness-presence');
      expect(presenceElement).not.toBeNull();
      expect(presenceElement.textContent).toBe(PRESENCE_MESSAGES.FEW);
    });
  });

  describe('Darkness payload builder integration', () => {
    it('should use custom darkness description when location has one', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      const customDescription =
        'Water drips from stalactites. The air is cold and musty.';
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'locations:description_in_darkness') {
            return { text: customDescription };
          }
          return null;
        }
      );

      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      const event = {
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      };
      turnStartedCallback(event);

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          isDark: true,
          description: customDescription,
        })
      );
    });

    it('should use default darkness description when none configured', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });
      mockEntityManager.getComponentData.mockReturnValue(null);

      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      const event = {
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      };
      turnStartedCallback(event);

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          isDark: true,
          description: DEFAULT_DARKNESS_DESCRIPTION,
        })
      );
    });

    it('should build complete darkness payload with correct structure', () => {
      const payload = buildDarknessPayload({
        locationName: 'The Abyss',
        darknessDescription: 'Absolute darkness.',
        otherActorCount: 5,
      });

      expect(payload).toEqual({
        name: 'The Abyss',
        description: 'Absolute darkness.',
        portraitPath: null,
        portraitAltText: null,
        exits: [],
        characters: [],
        isDark: true,
        otherActorCount: 5,
      });
    });
  });

  describe('Transition between lit and dark states', () => {
    it('should correctly transition from lit to dark', () => {
      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      // First: location is lit
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: true,
        lightSources: ['torch'],
      });

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      // Verify first render was for lit location
      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dark Cave',
          portraitPath: '/portraits/cave.png',
        })
      );

      // Second: location becomes dark
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      // Verify second render was for dark location
      expect(renderer.render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDark: true,
          portraitPath: null,
          exits: [],
          characters: [],
        })
      );
    });

    it('should correctly transition from dark to lit', () => {
      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      // First: location is dark
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          isDark: true,
        })
      );

      // Second: location becomes lit
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: true,
        lightSources: ['lantern'],
      });

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      // Verify second render was for lit location (no isDark property)
      const lastCall = renderer.render.mock.calls[1][0];
      expect(lastCall.isDark).toBeUndefined();
      expect(lastCall.portraitPath).toBe('/portraits/cave.png');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero actors gracefully in darkness', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([MOCK_PLAYER_ID])
      );
      mockEntityManager.getEntityInstance.mockReturnValue({
        id: MOCK_PLAYER_ID,
        hasComponent: () => false,
      });

      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          isDark: true,
          otherActorCount: 0,
        })
      );
    });

    it('should handle empty location name gracefully', () => {
      mockLightingStateService.getLocationLightingState.mockReturnValue({
        isLit: false,
        lightSources: [],
      });
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
        name: '',
        description: '',
        exits: [],
      });

      const renderer = new LocationRenderer(rendererDeps);
      jest.spyOn(renderer, 'render');

      turnStartedCallback({
        type: 'core:turn_started',
        payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
      });

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          isDark: true,
          name: '',
        })
      );
    });
  });
});
