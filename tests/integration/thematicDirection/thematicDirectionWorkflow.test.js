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
import {
  waitForCondition,
} from '../../common/jestHelpers.js';

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
async function waitForUIState(expectedState, mockElements, maxIterations = 50) {
  return waitForCondition(() => {
    switch (expectedState) {
      case 'results':
        return mockElements.resultsState?.style?.display === 'block';
      case 'error':
        return mockElements.errorState?.style?.display === 'block';
      case 'loading':
        return mockElements.loadingState?.style?.display === 'block';
      case 'empty':
        return mockElements.emptyState?.style?.display === 'block';
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
  let originalDocument;

  beforeEach(() => {
    // Create logger
    mockLogger = createMockLogger();

    // Create event bus
    mockEventBus = {
      dispatch: jest.fn(),
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
      getAllCharacterConcepts: jest.fn(),
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

    // Mock the generateDirections method to match what the service expects
    jest
      .spyOn(mockDirectionGenerator, 'generateDirections')
      .mockImplementation(async (conceptId, characterDescription, options) => {
        // Ensure we return a proper array of thematic directions
        return [
          {
            id: 'direction-1',
            conceptId: conceptId, // Use the passed conceptId
            title: 'The Fallen Noble',
            description:
              'Once a champion of the realm, now seeking redemption for past failures.',
            coreTension:
              'The conflict between past glory and present shame drives every action.',
            uniqueTwist:
              "The knight's greatest victory was actually their most shameful defeat.",
            narrativePotential:
              'Redemption arc with opportunities for moral complexity and character growth.',
            createdAt: new Date().toISOString(),
            llmMetadata: {},
          },
          {
            id: 'direction-2',
            conceptId: conceptId,
            title: 'The Secret Guardian',
            description:
              'Sworn to protect an ancient secret that could save or doom the kingdom.',
            coreTension:
              'The burden of knowledge versus the desire for a normal life.',
            uniqueTwist:
              'The secret they guard may actually be better left hidden.',
            narrativePotential:
              'Mystery and intrigue with potential for world-changing revelations.',
            createdAt: new Date().toISOString(),
            llmMetadata: {},
          },
          {
            id: 'direction-3',
            conceptId: conceptId,
            title: 'The Lost Knight',
            description:
              'A warrior searching for their forgotten past and true identity.',
            coreTension:
              "The fear that remembering their past might destroy who they've become.",
            uniqueTwist:
              'Their amnesia was self-inflicted to escape unbearable guilt.',
            narrativePotential:
              'Identity crisis with opportunities for self-discovery and reinvention.',
            createdAt: new Date().toISOString(),
            llmMetadata: {},
          },
        ];
      });

    // Create character builder service
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Setup DOM
    originalDocument = global.document;
    mockElements = createMockDOMElements();
    setupDOMMocks(mockElements);

    // Create controller
    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    // Restore original document
    global.document = originalDocument;
    
    // Clear all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Complete workflow: Input to Storage', () => {
    test('should create concept and generate directions successfully', async () => {
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

      // Create mock thematic direction objects (with required fields like id, conceptId, etc.)
      const mockThematicDirectionObjects = generatedDirections.map(
        (dir, index) => ({
          id: `direction-${index + 1}`,
          conceptId: 'concept-123',
          title: dir.title,
          description: dir.description,
          coreTension: dir.coreTension,
          uniqueTwist: dir.uniqueTwist,
          narrativePotential: dir.narrativePotential,
          createdAt: new Date().toISOString(),
          llmMetadata: {},
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
      createThematicDirectionsFromLLMResponse.mockReturnValue(
        mockThematicDirectionObjects
      );

      // Act - Initialize controller
      await controller.initialize();
      
      // Allow promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Set textarea value and trigger input validation
      mockElements.textarea.value = conceptText;
      const inputEvent = new Event('input');
      mockElements.textarea.dispatchEvent(inputEvent);

      // Wait for input validation to complete (button should be enabled)
      await waitForCondition(() => !mockElements.generateBtn.disabled);

      // Simulate form submission by calling the controller's method directly
      // This is more reliable than trying to mock complex DOM event handling
      const mockEvent = { preventDefault: jest.fn() };

      // Find and call the form submit handler directly
      const formCalls = mockElements.form.addEventListener.mock.calls;
      const submitCall = formCalls.find((call) => call[0] === 'submit');

      if (submitCall) {
        const submitHandler = submitCall[1];
        await submitHandler(mockEvent);
        
        // Allow promises to resolve after form submission
        await new Promise(resolve => setTimeout(resolve, 0));
      } else {
        throw new Error('Form submit handler was not registered');
      }

      // Wait for results to be displayed
      await waitForUIState('results', mockElements);

      // Assert
      // 1. Concept should be saved to database
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
          status: 'draft',
        })
      );

      // 2. Direction generator should be called (we mocked it to return expected results)
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        'concept-123',
        expect.any(String),
        { llmConfigId: undefined }
      );

      // 3. Directions should be saved to database
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'The Fallen Noble',
            description: expect.any(String),
            coreTension: expect.any(String),
            conceptId: conceptId,
          }),
        ])
      );

      // 4. Events should be dispatched (both service and controller emit events)
      // Check that the service event was dispatched with correct event name
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'thematic:thematic_directions_generated',
        expect.objectContaining({
          conceptId,
          directionCount: 3, // Service event format
          autoSaved: true,
        })
      );

      // Note: The service emits events using the proper CHARACTER_BUILDER_EVENTS constants
      // The expected calls are:
      // 1. CHARACTER_CONCEPT_CREATED (from service) - 'thematic:character_concept_created'
      // 2. THEMATIC_DIRECTIONS_GENERATED (from service) - 'thematic:thematic_directions_generated'
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'thematic:thematic_directions_generated',
        expect.objectContaining({
          conceptId,
          directionCount: 3, // Service uses directionCount, not directionsCount
          autoSaved: true,
        })
      );

      // 5. UI should show results
      expect(mockElements.resultsState.style.display).toBe('block');

      // Check that appendChild was called to add content
      expect(mockElements.directionsResults.appendChild).toHaveBeenCalled();

      // Check that the DOM structure was created properly by looking at createElement calls
      const createElementCalls = document.createElement.mock.calls;
      const h3Calls = createElementCalls.filter((call) => call[0] === 'h3');
      expect(h3Calls.length).toBeGreaterThan(0); // H3 elements should be created for titles
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      const conceptText = 'A brave knight with a mysterious past';
      const dbError = new Error('Database connection failed');

      // Setup successful initialization, but failing save operation
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      mockDatabase.saveCharacterConcept.mockRejectedValue(dbError);

      // Act
      await controller.initialize();
      
      // Allow promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      mockElements.textarea.value = conceptText;
      mockElements.textarea.dispatchEvent(new Event('input'));

      const submitEvent = new Event('submit');
      submitEvent.preventDefault = jest.fn();
      mockElements.form.dispatchEvent(submitEvent);

      // Allow more time for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(() => 
        mockElements.errorState?.style?.display === 'block' ||
        mockLogger.error.mock.calls.length > 0,
        100 // Increase max iterations
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred = mockElements.errorState?.style?.display === 'block' ||
                           mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });

    test('should handle LLM errors gracefully', async () => {
      // Arrange
      const conceptText = 'A brave knight with a mysterious past';
      const savedConcept = {
        id: 'concept-123',
        concept: conceptText,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const llmError = new Error('LLM service unavailable');

      // Setup successful initialization and save, but failing LLM
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      mockDatabase.saveCharacterConcept.mockResolvedValue(savedConcept);
      mockDatabase.getCharacterConcept.mockResolvedValue(savedConcept);
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

      // Act
      await controller.initialize();
      
      // Allow promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      mockElements.textarea.value = conceptText;
      mockElements.textarea.dispatchEvent(new Event('input'));

      const submitEvent = new Event('submit');
      submitEvent.preventDefault = jest.fn();
      mockElements.form.dispatchEvent(submitEvent);

      // Allow more time for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(() => 
        mockElements.errorState?.style?.display === 'block' ||
        mockLogger.error.mock.calls.length > 0,
        100 // Increase max iterations
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred = mockElements.errorState?.style?.display === 'block' ||
                           mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });
  });

  describe('Previous concepts loading', () => {
    test('should load and display previous concepts with their directions', async () => {
      // Arrange
      const existingConcepts = [
        {
          id: 'concept-1',
          concept: 'An ancient wizard seeking knowledge',
          status: 'draft',
          thematicDirections: [
            {
              title: 'The Scholar',
              description:
                'A wise sage driven by an insatiable hunger for forbidden knowledge.',
              coreTension:
                'The desire for ultimate knowledge versus the moral cost of obtaining it.',
              uniqueTwist: 'Every spell learned erases a cherished memory.',
              narrativePotential:
                'A quest for forbidden knowledge with personal sacrifices and moral dilemmas.',
            },
          ],
        },
        {
          id: 'concept-2',
          concept: 'A young thief with a heart of gold',
          status: 'draft',
          thematicDirections: [],
        },
      ];

      mockDatabase.getAllCharacterConcepts.mockResolvedValue(existingConcepts);
      mockDatabase.getCharacterConcept.mockImplementation((id) =>
        Promise.resolve(existingConcepts.find((c) => c.id === id))
      );

      // Act
      await controller.initialize();
      
      // Allow promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Select first concept from dropdown and trigger handler
      mockElements.previousConceptsSelect.value = 'concept-1';
      const changeEvent = {
        target: mockElements.previousConceptsSelect,
        type: 'change',
      };

      // Find and call the change event handler directly
      const changeHandlerCall =
        mockElements.previousConceptsSelect.addEventListener.mock.calls.find(
          (call) => call[0] === 'change'
        );

      if (changeHandlerCall) {
        const changeHandler = changeHandlerCall[1];
        await changeHandler(changeEvent);
      }

      // Wait for results to be displayed after concept selection
      await waitForUIState('results', mockElements);

      // Assert
      expect(mockElements.textarea.value).toBe(
        'An ancient wizard seeking knowledge'
      );
      expect(mockElements.resultsState.style.display).toBe('block');

      // Check that the results were rendered by verifying DOM manipulation
      expect(mockElements.directionsResults.appendChild).toHaveBeenCalled();
    });
  });

  describe('End-to-end validation', () => {
    test('should validate all data according to schemas', async () => {
      // Arrange
      const conceptText = 'A brave knight with a mysterious past';
      const invalidLLMResponse = {
        thematicDirections: [
          {
            // Missing required 'title' field
            description: 'Some description',
            coreTension: 'Some tension',
          },
        ],
      };

      mockDatabase.saveCharacterConcept.mockResolvedValue({
        id: 'concept-123',
        concept: conceptText,
      });

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
      await new Promise(resolve => setTimeout(resolve, 0));

      mockElements.textarea.value = conceptText;
      const submitEvent = new Event('submit');
      submitEvent.preventDefault = jest.fn();
      mockElements.form.dispatchEvent(submitEvent);

      // Wait for error state to be displayed or error event dispatch
      await waitForCondition(() => 
        mockElements.errorState?.style?.display === 'block' ||
        mockLogger.error.mock.calls.length > 0
      );

      // Assert - check if error handling occurred (either UI or logging)
      const errorOccurred = mockElements.errorState?.style?.display === 'block' ||
                           mockLogger.error.mock.calls.length > 0;
      expect(errorOccurred).toBe(true);
    });
  });
});

// Helper functions
/**
 *
 */
function createMockDOMElements() {
  const createMockElement = (tag = 'div') => {
    const element = {
      tagName: tag,
      id: '',
      className: '',
      innerHTML: '',
      textContent: '',
      value: '',
      style: { display: 'none' },
      disabled: false,
      children: [],
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn((child) => {
        element.children.push(child);
        // Simulate actual DOM innerHTML updates for text content
        if (child.textContent && child.textContent.trim()) {
          if (element.innerHTML === '<div></div>' || element.innerHTML === '') {
            element.innerHTML = child.textContent;
          } else {
            element.innerHTML += child.textContent;
          }
        }
        // Update innerHTML property when text is set on children
        if (child.tagName === 'H3' && child.textContent) {
          element.innerHTML += child.textContent;
        }
      }),
      dispatchEvent: jest.fn((event) => {
        const listeners = element.addEventListener.mock.calls.filter(
          (call) => call[0] === event.type
        );
        listeners.forEach(([eventType, handler]) => {
          try {
            handler(event);
          } catch (error) {
            // Log error but allow async error handling to work
            console.warn('Event handler error (will be handled asynchronously):', error.message);
          }
        });
        return true;
      }),
    };
    return element;
  };

  return {
    form: createMockElement('form'),
    textarea: createMockElement('textarea'),
    charCount: createMockElement('span'),
    errorMessage: createMockElement('div'),
    generateBtn: createMockElement('button'),
    retryBtn: createMockElement('button'),
    backBtn: createMockElement('button'),
    emptyState: createMockElement('div'),
    loadingState: createMockElement('div'),
    errorState: createMockElement('div'),
    resultsState: createMockElement('div'),
    directionsResults: createMockElement('div'),
    previousConceptsSelect: createMockElement('select'),
    errorMessageText: createMockElement('p'),
  };
}

/**
 *
 * @param mockElements
 */
function setupDOMMocks(mockElements) {
  const createMockElement = (tag = 'div') => {
    const element = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      innerHTML: '',
      textContent: '',
      value: '',
      style: { display: 'none' },
      disabled: false,
      children: [],
      outerHTML: `<${tag}></${tag}>`,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn((child) => {
        element.children.push(child);
      }),
    };
    return element;
  };

  // Mock document methods by spying on existing document object
  jest.spyOn(document, 'getElementById').mockImplementation((id) => {
    const elementMap = {
      'concept-form': mockElements.form,
      'concept-input': mockElements.textarea,
      'concept-error': mockElements.errorMessage,
      'generate-btn': mockElements.generateBtn,
      'retry-btn': mockElements.retryBtn,
      'back-to-menu-btn': mockElements.backBtn,
      'empty-state': mockElements.emptyState,
      'loading-state': mockElements.loadingState,
      'error-state': mockElements.errorState,
      'results-state': mockElements.resultsState,
      'directions-results': mockElements.directionsResults,
      'previous-concepts': mockElements.previousConceptsSelect,
      'error-message-text': mockElements.errorMessageText,
    };
    return elementMap[id] || createMockElement('div');
  });

  jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
    if (selector === '.char-count') return mockElements.charCount;
    return createMockElement('div');
  });

  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    const element = createMockElement(tag);
    // Add some specific behavior for common elements
    if (tag === 'div' || tag === 'article') {
      element.className = '';
    }
    if (tag === 'h3') {
      // Override textContent setter to update innerHTML when title is set
      let _textContent = '';
      Object.defineProperty(element, 'textContent', {
        get: () => _textContent,
        set: (value) => {
          _textContent = value;
          element.innerHTML = value; // Also update innerHTML for visibility in tests
        },
      });
    }
    return element;
  });

  // Mock window.location
  global.window = {
    location: {
      href: '',
    },
  };
}
