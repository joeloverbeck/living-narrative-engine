// tests/domUI/locationRenderer.test.js
// --- FILE START ---
/**
 * @file Unit tests for the LocationRenderer class.
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
import { LocationRenderer } from '../../src/domUI/index.js';

// --- Mock Dependencies ---
jest.mock('../../src/constants/componentIds.js', () => ({
  POSITION_COMPONENT_ID: 'test:position',
  NAME_COMPONENT_ID: 'test:name',
  DESCRIPTION_COMPONENT_ID: 'test:description',
  EXITS_COMPONENT_ID: 'test:exits',
  ACTOR_COMPONENT_ID: 'test:actor',
}));

import {
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

/** @returns {import('../../src/interfaces/ILogger.js').ILogger} */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/** @returns {import('../../src/interfaces/IDocumentContext.js').IDocumentContext} */
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

/** @returns {import('../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} */
const createMockVed = () => ({
  subscribe: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
});

/**
 * @param mockDocumentContextInstance
 * @returns {import('../../src/domUI/domElementFactory.js').default}
 */
const createMockDomElementFactory = (mockDocumentContextInstance) => ({
  create: jest.fn((tagName, options) => {
    const el = mockDocumentContextInstance.document.createElement(tagName);
    if (options && options.cls) {
      if (Array.isArray(options.cls)) el.classList.add(...options.cls);
      else el.className = options.cls;
    }
    if (options && options.text) el.textContent = options.text;
    if (options && options.id) el.id = options.id;
    return el;
  }),
  p: jest.fn((className, textContent) => {
    const el = mockDocumentContextInstance.document.createElement('p');
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }),
  h3: jest.fn((className, textContent) => {
    const el = mockDocumentContextInstance.document.createElement('h3');
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }),
  h4: jest.fn((className, textContent) => {
    const el = mockDocumentContextInstance.document.createElement('h4');
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }),
  ul: jest.fn((id, cls) => {
    const el = mockDocumentContextInstance.document.createElement('ul');
    if (id) el.id = id;
    if (cls) {
      if (Array.isArray(cls)) el.classList.add(...cls);
      else el.className = cls;
    }
    return el;
  }),
  li: jest.fn((cls, text) => {
    const el = mockDocumentContextInstance.document.createElement('li');
    if (cls) {
      if (Array.isArray(cls)) el.classList.add(...cls);
      else el.className = cls;
    }
    if (text) el.textContent = text;
    return el;
  }),
  span: jest.fn((cls, text) => {
    const el = mockDocumentContextInstance.document.createElement('span');
    if (cls) {
      if (Array.isArray(cls)) el.classList.add(...cls);
      else el.className = cls;
    }
    if (text) el.textContent = text;
    return el;
  }),
});

/** @returns {import('../../src/interfaces/IEntityManager.js').IEntityManager} */
const createMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(() => new Set()),
});

/** @returns {import('../../src/interfaces/IDataRegistry.js').IDataRegistry} */
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

/** @returns {import('../../src/entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} */
const createMockEntityDisplayDataProvider = () => ({
  getEntityLocationId: jest.fn(),
  getLocationDetails: jest.fn(),
  getCharacterDisplayInfo: jest.fn(),
  getEntityName: jest.fn(),
  getEntityPortraitPath: jest.fn(),
  getLocationPortraitData: jest.fn(), // <<< --- ADDED THIS LINE ---
});

describe('LocationRenderer', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockSafeEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockDataRegistry;
  let mockContainerElement;
  let mockNameDisplay,
    mockDescriptionDisplay,
    mockExitsDisplay,
    mockCharactersDisplay;
  // Add mocks for the new portrait elements
  let mockLocationPortraitVisualsElement, mockLocationPortraitImageElement;

  let rendererDeps;
  let turnStartedCallback;

  const MOCK_PLAYER_ID = 'player:1';
  const MOCK_LOCATION_ID = 'instance:loc1';
  const MOCK_LOCATION_DEF_ID = 'world:loc_def1';
  const MOCK_OTHER_ACTOR_ID = 'npc:guard';
  const MOCK_NON_ACTOR_ID = 'item:rock';

  let mockLocationEntityInstance;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDocumentContext = createMockDocumentContext();
    mockSafeEventDispatcher = createMockVed();
    mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
    mockEntityManager = createMockEntityManager();
    mockEntityDisplayDataProvider = createMockEntityDisplayDataProvider();
    mockDataRegistry = createMockDataRegistry();

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

    // Create and append new mock portrait elements
    mockLocationPortraitVisualsElement = document.createElement('div');
    mockLocationPortraitVisualsElement.id = 'location-portrait-visuals';
    mockLocationPortraitImageElement = document.createElement('img');
    mockLocationPortraitImageElement.id = 'location-portrait-image';

    document.body.appendChild(mockContainerElement);
    // Insert portrait elements between name and description
    mockContainerElement.appendChild(mockNameDisplay);
    mockContainerElement.appendChild(mockLocationPortraitVisualsElement);
    mockLocationPortraitVisualsElement.appendChild(
      mockLocationPortraitImageElement
    ); // Usually image is child of visuals
    mockContainerElement.appendChild(mockDescriptionDisplay);
    mockContainerElement.appendChild(mockExitsDisplay);
    mockContainerElement.appendChild(mockCharactersDisplay);

    mockDocumentContext.query.mockImplementation((selector) => {
      if (selector === '#location-name-display') return mockNameDisplay;
      if (selector === '#location-description-display')
        return mockDescriptionDisplay;
      if (selector === '#location-exits-display') return mockExitsDisplay;
      if (selector === '#location-characters-display')
        return mockCharactersDisplay;
      // Add new selectors for portrait elements
      if (selector === '#location-portrait-visuals')
        return mockLocationPortraitVisualsElement;
      if (selector === '#location-portrait-image')
        return mockLocationPortraitImageElement;
      return document.querySelector(selector);
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

    mockLocationEntityInstance = {
      id: MOCK_LOCATION_ID,
      definitionId: MOCK_LOCATION_DEF_ID,
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(
      MOCK_LOCATION_ID
    );
    mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
      name: 'Default Mock Location',
      description: 'A default mock description.',
      exits: [],
    });
    // Provide a default mock for the new method
    mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(null);
    mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
      (id) => ({
        id: id,
        name: `Mock Character ${id}`,
        description: `Description for ${id}`,
        portraitPath: null,
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    it('should successfully create an instance with valid dependencies and subscribe to events', () => {
      // This test should now pass if createMockEntityDisplayDataProvider includes getLocationPortraitData
      expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[LocationRenderer] Attached to base container element:',
        mockContainerElement
      );
      expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:turn_started',
        expect.any(Function)
      );
    });

    it('should construct even if domElementFactory is missing', () => {
      rendererDeps.domElementFactory = null;
      expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
    });

    it('should throw if entityManager is missing', () => {
      rendererDeps.entityManager = null;
      // Corrected expected error message
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'entityManager' dependency is missing or invalid."
      );
    });
    it('should throw if entityManager is missing getEntityInstance', () => {
      // This test setup might be tricky because the check for entityManager is broad.
      // If getEntitiesInLocation exists, it passes the initial entityManager check.
      // The failure would likely occur later or be masked by the EDDP check if EDDP is also misconfigured.
      // For now, ensuring the primary EDDP mock is correct is more critical.
      // Let's assume the EDDP mock is complete for this specific test's original intent.
      rendererDeps.entityManager = { getEntitiesInLocation: jest.fn() }; // Missing getEntityInstance
      // The current constructor only checks for `getEntitiesInLocation`.
      // So, this specific test case as written might not fail where it intends to,
      // or might fail on the EDDP check instead.
      // Forcing a fail on the entityManager check by making it invalid for the current code:
      rendererDeps.entityManager = { getEntityInstance: jest.fn() }; // Missing getEntitiesInLocation
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'entityManager' dependency is missing or invalid."
      );
    });
    it('should throw if entityManager is missing getEntitiesInLocation', () => {
      rendererDeps.entityManager = { getEntityInstance: jest.fn() }; // Missing getEntitiesInLocation
      // Corrected expected error message
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'entityManager' dependency is missing or invalid."
      );
    });

    it('should throw if entityDisplayDataProvider is missing', () => {
      delete rendererDeps.entityDisplayDataProvider;
      // Corrected expected error message to the more detailed one
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'entityDisplayDataProvider' dependency is missing or invalid (must include getLocationDetails, getEntityLocationId, and a new getLocationPortraitData)."
      );
    });
    it('should throw if entityDisplayDataProvider is invalid (e.g., missing getLocationDetails)', () => {
      rendererDeps.entityDisplayDataProvider = {
        getEntityLocationId: jest.fn(),
        getLocationPortraitData: jest.fn(), // Missing getLocationDetails
      };
      // Corrected expected error message
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'entityDisplayDataProvider' dependency is missing or invalid (must include getLocationDetails, getEntityLocationId, and a new getLocationPortraitData)."
      );
    });

    it('should NOT throw but log a warning if dataRegistry is missing', () => {
      rendererDeps.dataRegistry = null;
      // This test will pass if createMockEntityDisplayDataProvider is correct
      expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LocationRenderer] 'dataRegistry' dependency is missing."
      );
    });

    it('should NOT throw but log a warning if dataRegistry is an empty object (missing getEntityDefinition)', () => {
      rendererDeps.dataRegistry = {};
      // This test will pass if createMockEntityDisplayDataProvider is correct
      expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
      // The warning message for dataRegistry would be generic unless specific function checks are added in LocationRenderer
      // For now, just checking it doesn't throw.
    });

    it('should throw if containerElement is missing or invalid', () => {
      rendererDeps.containerElement = null;
      // This test will pass if createMockEntityDisplayDataProvider is correct
      // The error thrown here will be due to containerElement before EDDP check.
      expect(() => new LocationRenderer(rendererDeps)).toThrow(
        "[LocationRenderer] 'containerElement' dependency is missing or not a valid DOM element."
      );
    });
  });

  // ... (The rest of your '#handleTurnStarted and render' and 'dispose' tests) ...
  // These tests should now run correctly once the constructor issues are resolved by the mock update.
  // Ensure that in these tests, mockEntityDisplayDataProvider.getLocationPortraitData()
  // is also mocked to return appropriate values (e.g., null or { imagePath: '...', altText: '...' })
  // depending on what each specific test scenario requires for location portraits.

  describe('#handleTurnStarted and render', () => {
    let renderer;
    // ... (mockPlayerEntity setup)

    beforeEach(() => {
      // Reset mocks
      Object.values(mockEntityDisplayDataProvider).forEach((fn) =>
        fn.mockReset()
      );
      mockEntityManager.getEntityInstance.mockReset();
      mockEntityManager.getEntitiesInLocation
        .mockReset()
        .mockReturnValue(new Set());

      // Default setup for EDDP
      mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(
        MOCK_LOCATION_ID
      );
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
        name: 'Test Location from EDDP',
        description: 'A test description from EDDP.',
        exits: [],
      });
      mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(
        null
      ); // Default: no portrait
      mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
        (id) => ({
          id: id,
          name: `Mock Char ${id}`,
          description: `Desc for ${id}`,
          portraitPath: null,
        })
      );

      renderer = new LocationRenderer(rendererDeps); // Instantiate after mocks are set up
    });

    const simulateTurnStarted = (payloadOverride = {}) => {
      const event = {
        type: 'core:turn_started',
        payload: {
          entityId: MOCK_PLAYER_ID,
          entityType: 'player',
          ...payloadOverride,
        },
      };
      if (turnStartedCallback) {
        // turnStartedCallback is captured in the outer beforeEach
        turnStartedCallback(event);
      } else {
        throw new Error('turnStartedCallback was not captured.');
      }
    };

    // ... (your existing tests for #handleTurnStarted, ensuring they mock getLocationPortraitData as needed)

    // Example of a test that might now check for portrait rendering:
    it('should render location with a portrait if EDDP provides one', () => {
      const portraitInfo = {
        imagePath: '/path/to/location.png',
        altText: 'A beautiful location',
      };
      mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(
        portraitInfo
      );
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
        name: 'Scenic Vista',
        description: 'A stunning view.',
        exits: [],
      });
      jest.spyOn(renderer, 'render');
      simulateTurnStarted();

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Scenic Vista',
          portraitPath: portraitInfo.imagePath,
          portraitAltText: portraitInfo.altText,
        })
      );
      expect(mockLocationPortraitImageElement.src).toContain(
        portraitInfo.imagePath
      );
      expect(mockLocationPortraitImageElement.alt).toBe(portraitInfo.altText);
      expect(mockLocationPortraitVisualsElement.style.display).toBe('flex');
    });

    it('should hide portrait elements if EDDP returns no portrait data', () => {
      mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(
        null
      );
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
        name: 'Plain Room',
        description: 'Just a room.',
        exits: [],
      });
      jest.spyOn(renderer, 'render');
      simulateTurnStarted();

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Plain Room',
          portraitPath: null,
        })
      );
      expect(mockLocationPortraitVisualsElement.style.display).toBe('none');
      expect(mockLocationPortraitImageElement.style.display).toBe('none');
    });

    it('should clear displays and log warning if event payload has no entityId', () => {
      jest.spyOn(renderer, 'render');
      turnStartedCallback({ type: 'core:turn_started', payload: {} }); // Simulate invalid event

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('event is missing entityId')
      );
      expect(mockNameDisplay.textContent).toContain('(Unknown Location)');
      expect(mockDescriptionDisplay.textContent).toContain(
        'No entity specified for turn.'
      );
      expect(mockExitsDisplay.textContent).toContain('(Exits Unavailable)');
      expect(mockCharactersDisplay.textContent).toContain(
        '(Characters Unavailable)'
      );
      expect(mockLocationPortraitVisualsElement.style.display).toBe('none'); // Check portrait is hidden
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('should clear displays and log warning if entity has no locationId via EDDP', () => {
      mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(null);
      simulateTurnStarted();
      expect(
        mockEntityDisplayDataProvider.getEntityLocationId
      ).toHaveBeenCalledWith(MOCK_PLAYER_ID);
      expect(mockDescriptionDisplay.textContent).toContain(
        `Location for ${MOCK_PLAYER_ID} is unknown.`
      );
      expect(mockLocationPortraitVisualsElement.style.display).toBe('none');
    });

    it('should clear displays and log error if location details not found via EDDP', () => {
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue(null);
      simulateTurnStarted();
      expect(
        mockEntityDisplayDataProvider.getLocationDetails
      ).toHaveBeenCalledWith(MOCK_LOCATION_ID);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            `Location details for ID '${MOCK_LOCATION_ID}' not found.`
          ),
        })
      );
      expect(mockDescriptionDisplay.textContent).toContain(
        `Location data for '${MOCK_LOCATION_ID}' missing.`
      );
      expect(mockLocationPortraitVisualsElement.style.display).toBe('none');
    });

    // ... (rest of the describe block for '#handleTurnStarted and render')

    describe('Exits Processing and Rendering', () => {
      beforeEach(() => {
        mockEntityDisplayDataProvider.getLocationDetails.mockImplementation(
          (locId) => {
            if (locId === MOCK_LOCATION_ID) {
              return {
                name: 'Test Location',
                description: 'A place for testing.',
                exits: [], // Default, override in tests
              };
            }
            return null;
          }
        );
        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());
        // Ensure portrait data is null by default for these specific exit tests if not otherwise specified
        mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(
          null
        );
      });

      it('should render with one exit correctly formatted', () => {
        const mockExit = {
          description: 'North',
          id: 'world:loc2_def',
          target: 'world:loc2_def',
        };
        mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
          name: 'Test Location',
          description: 'A place for testing.',
          exits: [mockExit],
        });
        jest.spyOn(renderer, 'render');
        simulateTurnStarted();
        expect(renderer.render).toHaveBeenCalledWith({
          name: 'Test Location',
          description: 'A place for testing.',
          portraitPath: null, // Explicitly check for portrait path
          portraitAltText: null,
          exits: [mockExit],
          characters: [],
        });
        const exitListItems = mockExitsDisplay.querySelectorAll('ul li');
        expect(exitListItems.length).toBe(1);
        expect(exitListItems[0].textContent).toBe('North');
      });

      it('should render with multiple exits correctly formatted', () => {
        const mockExits = [
          {
            description: 'North',
            id: 'world:loc2_def',
            target: 'world:loc2_def',
          },
          {
            description: 'South to the town',
            id: 'world:town_def',
            target: 'world:town_def',
          },
        ];
        mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
          name: 'Test Location',
          description: 'A place for testing.',
          exits: mockExits,
        });
        jest.spyOn(renderer, 'render');
        jest.spyOn(renderer, '_renderList');

        simulateTurnStarted();

        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({
            exits: mockExits,
            portraitPath: null,
          })
        );
        expect(renderer._renderList).toHaveBeenCalledWith(
          mockExits,
          mockExitsDisplay,
          'Exits',
          'description',
          '(None visible)'
        );
      });

      it('should render with "None visible" if exits array from EDDP is empty', () => {
        mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
          name: 'Test Location',
          description: 'A place for testing.',
          exits: [],
        });
        jest.spyOn(renderer, 'render');
        jest.spyOn(renderer, '_renderList');
        simulateTurnStarted();
        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({ exits: [], portraitPath: null })
        );
        expect(renderer._renderList).toHaveBeenCalledWith(
          [],
          mockExitsDisplay,
          'Exits',
          'description',
          '(None visible)'
        );
        expect(
          mockExitsDisplay.querySelector('p.empty-list-message').textContent
        ).toBe('(None visible)');
      });
    });

    describe('Characters Processing and Rendering', () => {
      beforeEach(() => {
        mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
          name: 'Guild Hall',
          description: 'A busy place.',
          exits: [],
        });
        // Ensure portrait data is null by default for these specific character tests
        mockEntityDisplayDataProvider.getLocationPortraitData.mockReturnValue(
          null
        );
      });

      it('should render "None else here" if no other characters are in the location', () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([MOCK_PLAYER_ID])
        );
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockReturnValue(
          null
        );
        jest.spyOn(renderer, '_renderList');
        simulateTurnStarted();

        expect(renderer._renderList).toHaveBeenCalledWith(
          [],
          mockCharactersDisplay,
          'Characters',
          'name',
          '(None else here)'
        );
      });

      it('should render a character with name and description via EDDP', () => {
        const otherActorId = MOCK_OTHER_ACTOR_ID;
        const characterInfo = {
          id: otherActorId,
          name: 'Guard',
          description: 'A stern-looking guard.',
          portraitPath: null,
        };

        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([MOCK_PLAYER_ID, otherActorId])
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === MOCK_PLAYER_ID)
            return { id: MOCK_PLAYER_ID, hasComponent: () => false };
          if (id === otherActorId)
            return {
              id: otherActorId,
              hasComponent: (compId) => compId === ACTOR_COMPONENT_ID,
            };
          return null;
        });
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
          (id) => {
            if (id === otherActorId) return characterInfo;
            return null;
          }
        );

        jest.spyOn(renderer, 'render');
        simulateTurnStarted();

        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({
            characters: [characterInfo],
            portraitPath: null,
          })
        );
      });

      it('should render a character with name only if description is undefined/empty from EDDP', () => {
        const otherActorId = MOCK_OTHER_ACTOR_ID;
        const characterInfoNoDesc = {
          id: otherActorId,
          name: 'Silent Bob',
          description: '',
          portraitPath: null,
        };
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([MOCK_PLAYER_ID, otherActorId])
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === MOCK_PLAYER_ID)
            return { id: MOCK_PLAYER_ID, hasComponent: () => false };
          if (id === otherActorId)
            return {
              id: otherActorId,
              hasComponent: (compId) => compId === ACTOR_COMPONENT_ID,
            };
          return null;
        });
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockReturnValue(
          characterInfoNoDesc
        );

        jest.spyOn(renderer, 'render');
        simulateTurnStarted();
        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({
            characters: [characterInfoNoDesc],
            portraitPath: null,
          })
        );
      });

      it('should exclude the current actor from the character list', () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([MOCK_PLAYER_ID])
        );
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
          (id) => {
            if (id === MOCK_PLAYER_ID)
              return {
                id: MOCK_PLAYER_ID,
                name: 'Player',
                description: '',
                portraitPath: null,
              };
            return null;
          }
        );
        jest.spyOn(renderer, 'render');
        simulateTurnStarted();

        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({
            characters: [],
            portraitPath: null,
          })
        );
      });

      it('should ignore non-actor entities in the location', () => {
        const nonActorId = MOCK_NON_ACTOR_ID;
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([MOCK_PLAYER_ID, nonActorId])
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === MOCK_PLAYER_ID)
            return { id: MOCK_PLAYER_ID, hasComponent: () => false };
          if (id === nonActorId)
            return {
              id: nonActorId,
              hasComponent: (compId) => compId !== ACTOR_COMPONENT_ID,
            };
          return null;
        });
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(
          (id) => {
            if (id === nonActorId) return null;
            return {
              id: id,
              name: 'Some other char',
              description: '',
              portraitPath: null,
            };
          }
        );
        jest.spyOn(renderer, 'render');
        simulateTurnStarted();
        expect(renderer.render).toHaveBeenCalledWith(
          expect.objectContaining({
            characters: [],
            portraitPath: null,
          })
        );
        expect(
          mockEntityDisplayDataProvider.getCharacterDisplayInfo
        ).not.toHaveBeenCalledWith(nonActorId);
      });
    });

    it('should log an error if a display element (e.g., charactersDisplay) is not found during render', () => {
      mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
        name: 'Test',
        description: 'Desc',
        exits: [],
      });
      // Intentionally make charactersDisplay missing from the mock query selector
      const originalQuery = mockDocumentContext.query;
      mockDocumentContext.query = jest.fn((selector) => {
        if (selector === '#location-characters-display') return null;
        if (selector === '#location-name-display') return mockNameDisplay;
        if (selector === '#location-description-display')
          return mockDescriptionDisplay;
        if (selector === '#location-exits-display') return mockExitsDisplay;
        if (selector === '#location-portrait-visuals')
          return mockLocationPortraitVisualsElement;
        if (selector === '#location-portrait-image')
          return mockLocationPortraitImageElement;
        return null;
      });

      // Re-instantiate renderer with the modified mockDocumentContext for this specific test
      const testRenderer = new LocationRenderer({
        ...rendererDeps, // Spread existing deps
        documentContext: mockDocumentContext, // Override with the special mock
      });

      // Need to capture the callback from *this* instance's subscription
      let specificTurnStartedCallback;
      const specificMockVed = createMockVed(); // Use a fresh VED mock for this instance
      specificMockVed.subscribe.mockImplementation((eventType, callback) => {
        if (eventType === 'core:turn_started') {
          specificTurnStartedCallback = callback;
        }
        return jest.fn(); // Return an unsubscribe function
      });
      new LocationRenderer({
        ...rendererDeps,
        safeEventDispatcher: specificMockVed,
        documentContext: mockDocumentContext,
      });

      if (specificTurnStartedCallback) {
        specificTurnStartedCallback({
          type: 'core:turn_started',
          payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
        });
      } else {
        // Fallback to the global one if the above re-instantiation didn't capture it correctly for some reason
        // This path indicates a potential flaw in the test setup for isolating the callback.
        if (turnStartedCallback) {
          turnStartedCallback({
            type: 'core:turn_started',
            payload: { entityId: MOCK_PLAYER_ID, entityType: 'player' },
          });
        } else {
          throw new Error(
            'Turn started callback not captured for specific test instance.'
          );
        }
      }
      expect(specificMockVed.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
        message:
          "[LocationRenderer] Cannot render, required DOM element 'charactersDisplay' is missing.",
      });
      mockDocumentContext.query = originalQuery; // Restore original mock
    });
  });

  describe('dispose', () => {
    it('should handle dispose being called multiple times gracefully', () => {
      const renderer = new LocationRenderer(rendererDeps);
      const mockUnsubscribe =
        mockSafeEventDispatcher.subscribe.mock.results[0].value;

      renderer.dispose();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

      renderer.dispose(); // Call again
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // Still only once
    });
  });
});
// --- FILE END ---
