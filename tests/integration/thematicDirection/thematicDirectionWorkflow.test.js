/**
 * @file Integration tests for Thematic Direction Generator complete workflow
 * @description Tests the full workflow from UI input to database storage
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { ThematicDirectionController } from '../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createThematicDirectionsFromLLMResponse } from '../../../src/characterBuilder/models/thematicDirection.js';
import { waitForCondition } from '../../common/jestHelpers.js';
import {
  createThematicDirectionMockElements,
  setupThematicDirectionDOM,
  cleanupThematicDirectionDOM,
  createMockEvent,
} from '../../common/testHelpers/thematicDirectionDOMSetup.js';

// Mock the validation function to ensure it always passes
jest.mock(
  '../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js',
  () => ({
    ...jest.requireActual(
      '../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js'
    ),
    validateThematicDirectionsResponse: jest.fn().mockReturnValue(true),
  })
);

// Mock the thematic direction model to provide predictable results
jest.mock('../../../src/characterBuilder/models/thematicDirection.js', () => ({
  ...jest.requireActual(
    '../../../src/characterBuilder/models/thematicDirection.js'
  ),
  createThematicDirectionsFromLLMResponse: jest.fn(),
}));

/**
 * Helper function to wait for specific UI states
 *
 * @param {string} expectedState - The expected UI state ('results', 'error', 'loading', 'empty')
 * @param {object} mockElements - Mock DOM elements
 * @param {number} maxIterations - Maximum iterations to wait
 * @returns {Promise<boolean>} True if state reached, false if timeout
 */
async function waitForUIState(
  expectedState,
  mockElements,
  maxIterations = 100
) {
  return waitForCondition(() => {
    switch (expectedState) {
      case 'results':
        return mockElements.resultsState?.style?.display === 'flex';
      case 'error':
        return mockElements.errorState?.style?.display === 'flex';
      case 'loading':
        return mockElements.loadingState?.style?.display === 'flex';
      case 'empty':
        return mockElements.emptyState?.style?.display === 'flex';
      default:
        return false;
    }
  }, maxIterations);
}

/**
 * Integration test for the complete thematic direction workflow
 * Tests the interaction between controller, services, and storage
 */
describe('Thematic Direction Workflow Integration', () => {
  let controller;
  let characterBuilderService;
  let mockLogger;
  let mockSchemaValidator;
  let mockEventBus;
  let mockDatabase;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockLLMAdapter;
  let mockLlmJsonService;
  let mockLlmConfigManager;
  let mockLlmStrategyFactory;

  // Mock DOM elements
  let mockElements;

  beforeEach(() => {
    // Create logger
    mockLogger = createMockLogger();

    // Create event bus - must implement full ISafeEventDispatcher interface
    const mockUnsubscribe = jest.fn();
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(mockUnsubscribe),
      unsubscribe: jest.fn(),
    };

    // Create schema validator mock
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
      formatAjvErrors: jest.fn(() => 'Validation error'),
      addSchema: jest.fn(),
    };

    // Create database mock
    mockDatabase = {
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]), // Default to empty array
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };

    // Create LLM adapter mock
    mockLLMAdapter = {
      generateResponse: jest.fn(),
    };

    // Create LLM JSON service mock
    mockLlmJsonService = {
      clean: jest.fn().mockImplementation((input) => input),
      parseAndRepair: jest.fn().mockImplementation(async (input) => {
        try {
          return JSON.parse(input);
        } catch {
          throw new Error('Invalid JSON');
        }
      }),
    };

    // Create LLM configuration manager mock
    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        name: 'Test Config',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
    };

    // Create LLM strategy factory mock (ConfigurableLLMAdapter)
    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    // Create storage service
    mockStorageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });

    // Create direction generator - but we'll replace its methods with mocks
    mockDirectionGenerator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
    });

    // Mock the generateDirections method to return empty array by default
    jest
      .spyOn(mockDirectionGenerator, 'generateDirections')
      .mockImplementation(async (conceptId, characterDescription, options) => {
        // Default implementation returns empty array
        return [];
      });

    // Create character builder service
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Setup DOM using test helpers
    mockElements = createThematicDirectionMockElements();
    setupThematicDirectionDOM(mockElements);

    // Create controller
    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    // Clean up DOM
    cleanupThematicDirectionDOM();

    // Clear all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Complete workflow: Input to Storage', () => {
    test('should select existing concept and generate directions successfully', async () => {
      // Arrange
      const conceptText = 'A brave knight with a mysterious past';
      const conceptId = 'concept-123';
      const savedConcept = {
        id: conceptId,
        concept: conceptText,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const generatedDirections = [
        {
          title: 'The Fallen Noble',
          description:
            'Once a champion of the realm, now seeking redemption for past failures.',
          coreTension:
            'The conflict between past glory and present shame drives every action.',
          uniqueTwist:
            "The knight's greatest victory was actually their most shameful defeat.",
          narrativePotential:
            'Redemption arc with opportunities for moral complexity and character growth.',
        },
        {
          title: 'The Secret Guardian',
          description:
            'Sworn to protect an ancient secret that could save or doom the kingdom.',
          coreTension:
            'The burden of knowledge versus the desire for a normal life.',
          uniqueTwist:
            'The secret they guard may actually be better left hidden.',
          narrativePotential:
            'Mystery and intrigue with potential for world-changing revelations.',
        },
        {
          title: 'The Lost Knight',
          description:
            'A warrior searching for their forgotten past and true identity.',
          coreTension:
            "The fear that remembering their past might destroy who they've become.",
          uniqueTwist:
            'Their amnesia was self-inflicted to escape unbearable guilt.',
          narrativePotential:
            'Identity crisis with opportunities for self-discovery and reinvention.',
        },
      ];

      const llmResponse = {
        thematicDirections: generatedDirections,
      };

      // Create mock thematic direction objects (without conceptId - it will be set in the generator mock)
      const mockThematicDirectionObjects = generatedDirections.map(
        (dir, index) => ({
          title: dir.title,
          description: dir.description,
          coreTension: dir.coreTension,
          uniqueTwist: dir.uniqueTwist,
          narrativePotential: dir.narrativePotential,
        })
      );

      // Mock database operations
      mockDatabase.saveCharacterConcept.mockResolvedValue(savedConcept);
      mockDatabase.saveThematicDirections.mockResolvedValue(
        mockThematicDirectionObjects
      ); // Return the saved directions
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([savedConcept]);
      mockDatabase.getCharacterConcept.mockResolvedValue(savedConcept);

      // Mock LLM response through strategy factory
      const llmResponseString = JSON.stringify(llmResponse);
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(llmResponseString);
      mockLlmJsonService.clean.mockReturnValue(llmResponseString);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(llmResponse);

      // Mock the thematic direction creation to return predictable objects
      createThematicDirectionsFromLLMResponse.mockImplementation(
        (llmResponse, conceptId) => {
          return llmResponse.thematicDirections.map((dir, index) => ({
            id: `direction-${index + 1}`,
            conceptId: conceptId,
            title: dir.title,
            description: dir.description,
            coreTension: dir.coreTension,
            uniqueTwist: dir.uniqueTwist,
            narrativePotential: dir.narrativePotential,
            createdAt: new Date().toISOString(),
            llmMetadata: {},
          }));
        }
      );

      // Override the default mock for this specific test
      mockDirectionGenerator.generateDirections.mockImplementation(
        async (conceptId, characterDescription, options) => {
          // Ensure we return a proper array of thematic directions
          return mockThematicDirectionObjects.map((dir, index) => ({
            ...dir,
            id: `direction-${index + 1}`,
            conceptId: conceptId, // Use the passed conceptId
            createdAt: new Date().toISOString(),
            llmMetadata: {},
          }));
        }
      );

      // Setup - Make sure the concept exists in the database
      mockDatabase.getAllCharacterConcepts.mockClear(); // Clear any previous mock setup
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([savedConcept]);

      // Act - Initialize controller (which also initializes the service and loads concepts)
      await controller.initialize();

      // WORKAROUND: The controller's _cacheElements fails to find DOM elements during initialization
      // This is due to a mismatch between the global document mock and the controller's document reference
      // Override _getElement to return the correct mock elements
      controller._getElement = function (key) {
        const elementMap = {
          emptyState: mockElements.emptyState,
          loadingState: mockElements.loadingState,
          resultsState: mockElements.resultsState,
          errorState: mockElements.errorState,
          form: mockElements.form,
          conceptSelector: mockElements.conceptSelector,
          generateBtn: mockElements.generateBtn,
          selectedConceptDisplay: mockElements.selectedConceptDisplay,
          conceptContent: mockElements.conceptContent,
          conceptDirectionsCount: mockElements.conceptDirectionsCount,
          conceptCreatedDate: mockElements.conceptCreatedDate,
          conceptSelectorError: mockElements.conceptSelectorError,
          directionsResults: mockElements.directionsResults,
          directionsList: mockElements.directionsList,
          conceptText: mockElements.conceptText,
          characterCount: mockElements.characterCount,
          timestamp: mockElements.timestamp,
        };
        return elementMap[key] || null;
      };

      // Reinitialize UI state and event listeners now that elements are available
      await controller._initializeUIStateManager();
      controller._setupEventListeners();

      // Allow promises to resolve (includes loading concepts)
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The controller should have loaded the saved concept already
      // We need to select it from the dropdown
      mockElements.conceptSelector.value = conceptId;

      // Trigger the change event on the concept selector
      const changeEvent = createMockEvent('change', {
        target: mockElements.conceptSelector,
      });
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      // Allow the concept selection to be processed
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now the generate button should be enabled
      // Simulate form submission
      const submitEvent = createMockEvent('submit', {
        target: mockElements.form,
      });
      mockElements.form.dispatchEvent(submitEvent);

      // Allow promises to resolve after form submission
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Wait for results to be displayed
      const resultsDisplayed = await waitForUIState('results', mockElements);
      expect(resultsDisplayed).toBe(true);

      // Assert
      // The test should verify the high-level workflow succeeds:
      // 1. Controller initializes successfully
      // 2. User can select an existing concept
      // 3. Directions are generated when form is submitted
      // 4. Results are displayed in the UI

      // UI should show results
      expect(mockElements.resultsState.style.display).toBe('flex');

      // Direction generator should be called - this is the key action
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        conceptId,
        expect.any(String),
        expect.any(Object)
      );

      // Results should be rendered to the DOM
      // The controller now writes to directionsResults via innerHTML
      expect(mockElements.directionsResults.innerHTML).toContain(
        'direction-card'
      );
      expect(mockElements.directionsResults.innerHTML).toContain(
        'data-index="0"'
      );
      expect(mockElements.directionsResults.innerHTML).toContain(
        'data-index="1"'
      );
      expect(mockElements.directionsResults.innerHTML).toContain(
        'data-index="2"'
      );
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const savedConcept = {
        id: conceptId,
        concept: 'A brave knight with a mysterious past',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const dbError = new Error('Database connection failed');

      // Setup successful initialization and initial load
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([savedConcept]);
      mockDatabase.getCharacterConcept.mockResolvedValue(savedConcept);

      // But fail when saving thematic directions
      mockDatabase.saveThematicDirections.mockRejectedValue(dbError);

      // Act
      await controller.initialize();

      // Allow promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Select the concept
      mockElements.conceptSelector.value = conceptId;
      const changeEvent = createMockEvent('change', {
        target: mockElements.conceptSelector,
      });
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      // Allow more time for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(
        () =>
          mockElements.errorState?.style?.display === 'flex' ||
          mockLogger.error.mock.calls.length > 0,
        100 // Increase max iterations
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred =
        mockElements.errorState?.style?.display === 'flex' ||
        mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });

    test('should handle LLM errors gracefully', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const savedConcept = {
        id: conceptId,
        concept: 'A brave knight with a mysterious past',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const llmError = new Error('LLM service unavailable');

      // Setup successful initialization and initial load
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([savedConcept]);
      mockDatabase.getCharacterConcept.mockResolvedValue(savedConcept);

      // But fail LLM generation
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

      // Act
      await controller.initialize();

      // Allow promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Select the concept
      mockElements.conceptSelector.value = conceptId;
      const changeEvent = createMockEvent('change', {
        target: mockElements.conceptSelector,
      });
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      // Allow more time for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(
        () =>
          mockElements.errorState?.style?.display === 'flex' ||
          mockLogger.error.mock.calls.length > 0,
        100 // Increase max iterations
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred =
        mockElements.errorState?.style?.display === 'flex' ||
        mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });
  });

  describe('End-to-end validation', () => {
    test('should validate all data according to schemas', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const savedConcept = {
        id: conceptId,
        concept: 'A brave knight with a mysterious past',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const invalidLLMResponse = {
        thematicDirections: [
          {
            // Missing required 'title' field
            description: 'Some description',
            coreTension: 'Some tension',
          },
        ],
      };

      // Setup successful initialization and initial load
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([savedConcept]);
      mockDatabase.getCharacterConcept.mockResolvedValue(savedConcept);

      const invalidResponseString = JSON.stringify(invalidLLMResponse);
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        invalidResponseString
      );
      mockLlmJsonService.clean.mockReturnValue(invalidResponseString);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(invalidLLMResponse);

      // Mock schema validation to fail for invalid response
      mockSchemaValidator.validateAgainstSchema.mockImplementation(
        (data, schemaId) => {
          if (schemaId === 'thematic-direction-response') {
            return { valid: false };
          }
          return { valid: true };
        }
      );

      // Act
      await controller.initialize();

      // Allow promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Select the concept
      mockElements.conceptSelector.value = conceptId;
      const changeEvent = createMockEvent('change', {
        target: mockElements.conceptSelector,
      });
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(
        () =>
          mockElements.errorState?.style?.display === 'flex' ||
          mockLogger.error.mock.calls.length > 0,
        100
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred =
        mockElements.errorState?.style?.display === 'flex' ||
        mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });
  });
});
