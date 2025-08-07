/**
 * @file Integration tests for ThematicDirectionsManagerApp startup
 * @description Tests the complete startup workflow including DI container setup and service resolution
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';

// Import the main app class for testing
let ThematicDirectionsManagerApp;

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

global.indexedDB = mockIndexedDB;

// Mock external dependencies
jest.mock('../../../src/characterBuilder/storage/characterDatabase.js', () => {
  return {
    CharacterDatabase: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      findOrphanedDirections: jest.fn().mockResolvedValue([]),
    })),
  };
});

jest.mock(
  '../../../src/characterBuilder/services/characterStorageService.js',
  () => {
    return {
      CharacterStorageService: jest.fn(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
        getAllThematicDirections: jest.fn().mockResolvedValue([]),
        getCharacterConcept: jest.fn(),
        findOrphanedDirections: jest.fn().mockResolvedValue([]),
        updateThematicDirection: jest.fn(),
        deleteThematicDirection: jest.fn(),
      })),
    };
  }
);

jest.mock(
  '../../../src/characterBuilder/services/characterBuilderService.js',
  () => {
    const mockService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
      getOrphanedThematicDirections: jest.fn().mockResolvedValue([]),
      updateThematicDirection: jest.fn(),
      deleteThematicDirection: jest.fn(),
      cleanupOrphanedDirections: jest.fn().mockResolvedValue(0),
    };

    return {
      CharacterBuilderService: jest.fn(() => mockService),
      __mockService: mockService,
    };
  }
);

describe('ThematicDirectionsManagerApp Startup Integration', () => {
  let app;
  let mockCharacterBuilderService;
  let mockDocument;
  let originalFetch;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Store original fetch
    originalFetch = global.fetch;

    // Get the mock service
    const { __mockService } = await import(
      '../../../src/characterBuilder/services/characterBuilderService.js'
    );
    mockCharacterBuilderService = __mockService;

    // Mock schema loading with comprehensive schema responses
    global.fetch = jest.fn().mockImplementation((url) => {
      // Handle different schema requests
      if (url.includes('schema')) {
        const fileName = url.split('/').pop();
        const schemaId = fileName.replace('.schema.json', '');

        // Provide specific schemas for known types
        let schema;

        if (fileName === 'game.schema.json') {
          schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'schema://living-narrative-engine/game.schema.json',
            title: 'Game Configuration',
            description: 'Schema for the game configuration file',
            type: 'object',
            properties: {
              mods: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
              },
              startWorld: {
                type: 'string',
              },
            },
            required: ['mods'],
            additionalProperties: false,
          };
        } else if (fileName === 'character-concept.schema.json') {
          schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'schema://living-narrative-engine/character-concept.schema.json',
            title: 'Character Concept',
            type: 'object',
            properties: {
              id: { type: 'string' },
              concept: { type: 'string' },
            },
            required: ['id', 'concept'],
            additionalProperties: true,
          };
        } else if (fileName === 'thematic-direction.schema.json') {
          schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'schema://living-narrative-engine/thematic-direction.schema.json',
            title: 'Thematic Direction',
            type: 'object',
            properties: {
              id: { type: 'string' },
              conceptId: { type: 'string' },
              direction: { type: 'string' },
            },
            required: ['id', 'conceptId', 'direction'],
            additionalProperties: true,
          };
        } else {
          // Generic schema for unknown types
          schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: `schema://living-narrative-engine/${fileName}`,
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            additionalProperties: true,
          };
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(schema),
        });
      }

      // Handle game.json configuration file
      if (url.includes('game.json')) {
        const gameConfig = {
          mods: ['core'],
          startWorld: 'test:world',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(gameConfig),
          text: () => Promise.resolve(JSON.stringify(gameConfig)),
        });
      }

      // Default response for other requests
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });
    });

    // jsdom provides a real document, so let's use it
    mockDocument = global.document;

    // Clear body and recreate to ensure clean state
    document.body.innerHTML = '';

    // Mock DOM elements that the controller expects using real DOM elements
    const createMockElement = (id, tagName = 'DIV') => {
      // Create a real DOM element using jsdom's document
      const element = document.createElement(tagName.toLowerCase());
      element.id = id;

      // Add the element to document.body so it passes the "contains" check
      document.body.appendChild(element);

      return element;
    };

    // Map of required element IDs to mock elements
    const mockElements = {};

    // Define elements with their proper IDs (kebab-case as they appear in HTML)
    // The controller uses camelCase keys but queries by kebab-case IDs
    const elementDefinitions = [
      { id: 'empty-state', tagName: 'DIV' },
      { id: 'loading-state', tagName: 'DIV' },
      { id: 'error-state', tagName: 'DIV' },
      { id: 'results-state', tagName: 'DIV' },
      { id: 'concept-selector', tagName: 'SELECT' }, // This must be a SELECT element
      { id: 'direction-filter', tagName: 'DIV' },
      { id: 'directions-results', tagName: 'DIV' },
      { id: 'refresh-btn', tagName: 'BUTTON' },
      { id: 'cleanup-orphans-btn', tagName: 'BUTTON' },
      { id: 'back-to-menu-btn', tagName: 'BUTTON' },
      { id: 'retry-btn', tagName: 'BUTTON' },
      { id: 'concept-display-container', tagName: 'DIV' },
      { id: 'concept-display-content', tagName: 'DIV' },
      { id: 'error-message-text', tagName: 'DIV' },
      { id: 'total-directions', tagName: 'SPAN' },
      { id: 'orphaned-count', tagName: 'SPAN' },
      { id: 'confirmation-modal', tagName: 'DIV' },
      // Add missing modal elements
      { id: 'modal-title', tagName: 'H3' },
      { id: 'modal-message', tagName: 'P' },
      { id: 'modal-confirm-btn', tagName: 'BUTTON' },
      { id: 'modal-cancel-btn', tagName: 'BUTTON' },
    ];

    elementDefinitions.forEach(({ id, tagName }) => {
      mockElements[id] = createMockElement(id, tagName);
    });

    // Since we're using real DOM elements, just use the native methods
    // The elements are already added to the document.body with their IDs set
    // Don't mock document.createElement - we need the real one for our elements to work

    // Import the app class after mocks are set up
    const module = await import(
      '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js'
    );
    ThematicDirectionsManagerApp =
      module.default || module.ThematicDirectionsManagerApp;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up globals
    delete global.document;

    // Clear all mocks
    jest.clearAllMocks();
  });

  test('should successfully initialize with proper DI container setup', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act & Assert - initialization should complete without DI resolution errors
    // The main goal is to ensure DI container doesn't throw "No service registered" errors
    await expect(app.initialize()).resolves.not.toThrow();
  });

  test('should resolve ThematicDirectionsManagerController from DI container', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act - should complete initialization, proving DI resolution worked
    await app.initialize();

    // Assert - if we got here, the DI container successfully resolved the controller
    // (the previous bug would have thrown "No service registered for key 'undefined'")
    // The test succeeds by not throwing during initialization
    expect(app).toBeDefined();
  });

  test('should register all required services in DI container', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act & Assert - should not throw during initialization
    await expect(app.initialize()).resolves.not.toThrow();
  });

  test('should handle multiple initialization attempts gracefully', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act
    await app.initialize(); // First initialization

    // Capture console warnings to verify second init is skipped
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await app.initialize(); // Second initialization should be skipped

    // Assert - should warn about already being initialized
    expect(warnSpy).toHaveBeenCalledWith(
      'ThematicDirectionsManagerApp: Already initialized'
    );
    warnSpy.mockRestore();
  });

  test('should properly register event definitions with schema validation', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act - should complete without errors
    await expect(app.initialize()).resolves.not.toThrow();

    // Assert - verify fetch was called for schema loading
    expect(global.fetch).toHaveBeenCalled();
  });

  test('should be resilient to schema loading failures and continue initialization', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Mock fetch to fail on schema loading - this should not prevent initialization
    // because the CharacterBuilderBootstrap is designed to be resilient
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Act - The initialization should succeed despite schema loading failures
    await expect(app.initialize()).resolves.not.toThrow();

    // Verify that the app was still initialized successfully
    // (The bootstrap logs warnings but continues)
    expect(app).toBeDefined();
  });

  test('should initialize LLM adapter during startup', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act - should complete initialization including LLM adapter
    await expect(app.initialize()).resolves.not.toThrow();

    // Assert - initialization completed (LLM adapter init is tested implicitly)
    // The test succeeds by completing without errors
    expect(app).toBeDefined();
  });

  test('should load and compile all schemas during initialization', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();

    // Act
    await app.initialize();

    // Assert - fetch should have been called for schema loading
    expect(global.fetch).toHaveBeenCalled();

    // Verify some expected schema requests were made
    const fetchCalls = global.fetch.mock.calls;
    const schemaRequests = fetchCalls.filter(
      (call) => call[0] && call[0].includes('schema')
    );
    expect(schemaRequests.length).toBeGreaterThan(0);
  });
});
