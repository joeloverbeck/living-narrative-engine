/**
 * @file Integration test for the complete concept loading flow in thematic direction generator
 * @description Tests the end-to-end process from concept creation to dropdown population
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
// Import controller inside tests to ensure proper mocking
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

// Mock DOM environment
const mockDocument = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  createElement: jest.fn(),
};

describe('Thematic Direction Concept Loading Flow - Integration', () => {
  let controller;
  let builderService;
  let storageService;
  let database;
  let mockLogger;
  let mockEventBus;
  let mockSchemaValidator;
  let mockDirectionGenerator;
  let mockElements;
  let asyncUtilitiesToolkit;
  let domElementManager;
  let eventListenerRegistry;
  let controllerLifecycleOrchestrator;
  let performanceMonitor;
  let memoryManager;
  let errorHandlingStrategy;
  let validationService;

  beforeEach(async () => {
    // Set up global document mock by spying on existing document methods
    jest.spyOn(document, 'getElementById');
    jest.spyOn(document, 'querySelector');
    jest.spyOn(document, 'createElement');

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}), // Returns unsubscribe function
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      formatAjvErrors: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Create mock DOM elements
    mockElements = {
      form: { addEventListener: jest.fn() },
      textarea: {
        addEventListener: jest.fn(),
        value: '',
        setAttribute: jest.fn(),
      },
      charCount: { textContent: '' },
      errorMessage: { textContent: '' },
      generateBtn: { disabled: false },
      retryBtn: { addEventListener: jest.fn() },
      backBtn: { addEventListener: jest.fn() },
      emptyState: { style: { display: 'none' } },
      loadingState: { style: { display: 'none' } },
      errorState: { style: { display: 'none' } },
      resultsState: { style: { display: 'none' } },
      directionsResults: { innerHTML: '', appendChild: jest.fn() },
      errorMessageText: { textContent: '' },
    };

    // Mock DOM methods using the real document object
    document.getElementById.mockImplementation((id) => {
      const elementMap = {
        'concept-form': mockElements.form,
        'concept-input': mockElements.textarea,
        'generate-btn': mockElements.generateBtn,
        'retry-btn': mockElements.retryBtn,
        'back-to-menu-btn': mockElements.backBtn,
        'empty-state': mockElements.emptyState,
        'loading-state': mockElements.loadingState,
        'error-state': mockElements.errorState,
        'results-state': mockElements.resultsState,
        'directions-results': mockElements.directionsResults,
        'concept-error': mockElements.errorMessage,
        'error-message-text': mockElements.errorMessageText,
      };
      return elementMap[id] || null;
    });

    document.querySelector.mockImplementation((selector) => {
      if (selector === '.char-count') return mockElements.charCount;
      return null;
    });

    const mockOption = {
      textContent: '',
      value: '',
      selected: false,
    };
    document.createElement.mockReturnValue(mockOption);

    asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
      logger: mockLogger,
      defaultWait: 5,
      instrumentation: { logTimerEvents: false },
    });

    domElementManager = new DOMElementManager({
      logger: mockLogger,
      documentRef: document,
      performanceRef: performance,
      elementsRef: {},
      contextName: 'IntegrationDOMElementManager',
    });

    eventListenerRegistry = new EventListenerRegistry({
      logger: mockLogger,
      asyncUtilities: asyncUtilitiesToolkit,
      contextName: 'IntegrationEventListenerRegistry',
    });

    controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
      logger: mockLogger,
      eventBus: mockEventBus,
    });

    performanceMonitor = new PerformanceMonitor({
      logger: mockLogger,
      eventBus: mockEventBus,
      threshold: 25,
      contextName: 'IntegrationPerformanceMonitor',
    });

    memoryManager = new MemoryManager({
      logger: mockLogger,
      contextName: 'IntegrationMemoryManager',
    });

    errorHandlingStrategy = new ErrorHandlingStrategy({
      logger: mockLogger,
      eventBus: mockEventBus,
      controllerName: 'ThematicDirectionController',
      errorCategories: ERROR_CATEGORIES,
      errorSeverity: ERROR_SEVERITY,
    });

    validationService = new ValidationService({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
      handleError: (error, context) =>
        mockLogger.error('Validation error', error, context),
      errorCategories: ERROR_CATEGORIES,
    });

    // Create real service instances with mocked dependencies
    database = new CharacterDatabase({ logger: mockLogger });

    // Mock the database methods for testing
    database.initialize = jest.fn().mockResolvedValue();
    database.getAllCharacterConcepts = jest.fn().mockResolvedValue([]);
    database.saveCharacterConcept = jest
      .fn()
      .mockImplementation((concept) => Promise.resolve(concept));
    database.getCharacterConcept = jest.fn();

    storageService = new CharacterStorageService({
      logger: mockLogger,
      database: database,
      schemaValidator: mockSchemaValidator,
    });

    builderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: storageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Import the controller dynamically after setting up mocks
    const { ThematicDirectionController } = await import(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js'
    );

    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService: builderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    // Initialize the storage service
    await storageService.initialize();

    // Initialize the builder service to complete the chain
    await builderService.initialize();

    // Add spies to track method calls through the service chain
    jest.spyOn(builderService, 'getAllCharacterConcepts');
    jest.spyOn(storageService, 'listCharacterConcepts');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Concept Loading Flow', () => {
    it('should create and store new concept through the complete flow', async () => {
      // Arrange
      const conceptText = 'A mysterious wanderer with ancient powers';
      const createdConcept = createCharacterConcept(conceptText);

      database.getAllCharacterConcepts.mockResolvedValue([]);
      await controller.initialize();

      // Act
      const savedConcept =
        await builderService.createCharacterConcept(conceptText);

      // Assert
      expect(database.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
          status: 'draft',
        })
      );
      expect(savedConcept).toMatchObject({
        concept: conceptText,
        status: 'draft',
      });
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:character_concept_created',
        expect.objectContaining({
          conceptId: savedConcept.id,
          autoSaved: true,
        })
      );
    });

    it('should retrieve concept by ID for dropdown selection', async () => {
      // Arrange
      const conceptText = 'A heroic paladin defending the innocent';
      const mockConcept = createCharacterConcept(conceptText);
      database.getCharacterConcept.mockResolvedValue(mockConcept);
      database.getAllCharacterConcepts.mockResolvedValue([mockConcept]);

      await controller.initialize();

      // Act
      const retrievedConcept = await builderService.getCharacterConcept(
        mockConcept.id
      );

      // Assert
      expect(database.getCharacterConcept).toHaveBeenCalledWith(mockConcept.id);
      expect(retrievedConcept).toEqual(mockConcept);
    });

    it('should integrate with character builder service for concept retrieval', async () => {
      // Arrange
      const mockConcepts = [
        createCharacterConcept(
          'A cunning thief with a mysterious past and hidden agenda'
        ),
        createCharacterConcept(
          'A noble warrior seeking redemption for past mistakes'
        ),
      ];
      database.getAllCharacterConcepts.mockResolvedValue(mockConcepts);

      // Act
      const concepts = await builderService.getAllCharacterConcepts();

      // Assert
      expect(concepts).toEqual(mockConcepts);
      expect(database.getAllCharacterConcepts).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should fail initialization when concept loading fails', async () => {
      // Arrange
      database.getAllCharacterConcepts.mockRejectedValue(
        new Error('Database error')
      );

    // Act & Assert
    await expect(controller.initialize()).rejects.toThrow(
      /initial data loading failed: .*Database error/
    );

      // Verify the error was logged appropriately
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate concepts meet minimum requirements', async () => {
      // Arrange
      const shortConcept = 'Short';

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(shortConcept)
      ).rejects.toThrow('concept must be at least 10 characters long');
    });
  });
});
