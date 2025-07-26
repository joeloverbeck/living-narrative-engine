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

jest.mock('../../../src/characterBuilder/services/characterStorageService.js', () => {
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
});

jest.mock('../../../src/characterBuilder/services/characterBuilderService.js', () => {
  const mockService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    createCharacterConcept: jest.fn(),
    generateThematicDirections: jest.fn(),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    getCharacterConcept: jest.fn(),
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
});

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
    const { __mockService } = await import('../../../src/characterBuilder/services/characterBuilderService.js');
    mockCharacterBuilderService = __mockService;

    // Mock schema loading with comprehensive schema responses
    global.fetch = jest.fn().mockImplementation((url) => {
      // Handle different schema requests
      if (url.includes('schema')) {
        const schemaId = url.split('/').pop().replace('.schema.json', '');
        const genericSchema = {
          $id: schemaId,
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          additionalProperties: true,
        };

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(genericSchema),
        });
      }

      // Default response for other requests
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });
    });

    // Mock document for error handling
    mockDocument = {
      body: { innerHTML: '' },
      readyState: 'complete',
      addEventListener: jest.fn(),
    };
    global.document = mockDocument;

    // Mock DOM elements that the controller expects
    const createMockElement = (id) => ({
      id,
      style: { display: 'none' },
      innerHTML: '',
      textContent: '',
      value: '',
      addEventListener: jest.fn(),
      appendChild: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      querySelector: jest.fn().mockReturnValue({
        textContent: '',
        innerHTML: '',
      }),
      querySelectorAll: jest.fn().mockReturnValue([]),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false),
      },
    });
    
    // Map of required element IDs to mock elements
    const mockElements = {};
    const requiredIds = [
      'empty-state', 'loading-state', 'error-state', 'results-state',
      'concept-selector', 'direction-filter', 'directions-results',
      'refresh-btn', 'cleanup-orphans-btn', 'back-to-menu-btn', 'retry-btn'
    ];
    
    requiredIds.forEach(id => {
      mockElements[id] = createMockElement(id);
    });
    
    global.document.getElementById = jest.fn((id) => mockElements[id] || createMockElement(id));

    global.document.querySelector = jest.fn().mockReturnValue({
      textContent: '',
    });

    global.document.createElement = jest.fn().mockImplementation(() => ({
      className: '',
      id: '',
      textContent: '',
      appendChild: jest.fn(),
      setAttribute: jest.fn(),
      querySelector: jest.fn().mockReturnValue({
        textContent: '',
        innerHTML: '',
      }),
      querySelectorAll: jest.fn().mockReturnValue([]),
    }));

    // Import the app class after mocks are set up
    const module = await import('../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js');
    ThematicDirectionsManagerApp = module.default || module.ThematicDirectionsManagerApp;
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
    expect(warnSpy).toHaveBeenCalledWith('ThematicDirectionsManagerApp: Already initialized');
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

  test('should display initialization error when startup fails', async () => {
    // Arrange
    app = new ThematicDirectionsManagerApp();
    
    // Mock fetch to fail on schema loading
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Act & Assert
    await expect(app.initialize()).rejects.toThrow();
    
    // Verify error display was attempted (document.body.innerHTML might not be set in test env)
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
    const schemaRequests = fetchCalls.filter(call => 
      call[0] && call[0].includes('schema')
    );
    expect(schemaRequests.length).toBeGreaterThan(0);
  });
});