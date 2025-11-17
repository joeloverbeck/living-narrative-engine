/**
 * @file Integration test for traits generator concept handling
 * @description Tests the full flow from direction selection to traits generation with proper concept handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';

describe('TraitsGeneratorController Integration - Concept Handling', () => {
  let controller;
  let characterBuilderService;
  let mockLogger;
  let mockEventBus;
  let mockTraitsDisplayEnhancer;
  let container;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockSchemaValidator;
  let mockTraitsGenerator;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockTokenEstimator;
  let createControllerInstance;

  const mockDirectionWithConcept = {
    direction: {
      id: 'dir-123',
      title: "Wanderer's Path",
      description: 'A journey of self-discovery through unknown lands',
      conceptId: 'concept-456',
      coreTension: 'Freedom vs belonging',
      uniqueTwist: 'The wanderer cannot remember their origin',
      narrativePotential: 'Exploration of identity and home',
    },
    concept: {
      id: 'concept-456',
      concept:
        'A mysterious wanderer searching for their forgotten past while helping others find their way',
      name: 'Amnesiac Guide',
    },
  };

  const mockCoreMotivations = [
    {
      id: 'motivation-1',
      coreDesire: 'To recover lost memories',
      internalContradiction: 'Fears what the truth might reveal',
      centralQuestion:
        'Is it better to know a painful truth or live in peaceful ignorance?',
    },
  ];

  const mockCliches = [
    {
      id: 'cliche-1',
      category: 'backstory',
      content: 'Mysterious past with hidden significance',
    },
  ];

  beforeEach(async () => {
    // Mock required services for CharacterBuilderService
    mockStorageService = {
      initialize: jest.fn(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      getAllThematicDirections: jest
        .fn()
        .mockResolvedValue([mockDirectionWithConcept.direction]),
      getCharacterConcept: jest
        .fn()
        .mockResolvedValue(mockDirectionWithConcept.concept),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Create DOM structure
    container = document.createElement('div');
    container.innerHTML = `
      <select id="direction-selector">
        <option value="">-- Choose --</option>
      </select>
      <div id="selected-direction-display" style="display: none;"></div>
      <div id="direction-title"></div>
      <div id="direction-description"></div>
      <textarea id="core-motivation-input"></textarea>
      <textarea id="internal-contradiction-input"></textarea>
      <textarea id="central-question-input"></textarea>
      <button id="generate-btn" disabled></button>
      <div id="core-motivations-panel" style="display: none;"></div>
      <div id="core-motivations-list"></div>
      <div id="user-input-summary" style="display: none;"></div>
      <div id="loading-state" style="display: none;"></div>
      <div id="results-state" style="display: none;"></div>
      <div id="traits-results"></div>
      <div id="direction-selector-error"></div>
      <div id="input-validation-error"></div>
      <button id="export-btn"></button>
      <button id="clear-btn"></button>
      <button id="back-btn"></button>
      <div id="empty-state"></div>
      <div id="error-state" style="display: none;"></div>
      <div id="error-message-text"></div>
      <div id="loading-message"></div>
    `;

    // Mock DOM methods that might not exist in jsdom
    Element.prototype.scrollIntoView = jest.fn();
    document.body.appendChild(container);

    // Set up mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn(),
      validateAgainstSchema: jest.fn(),
    };

    mockTraitsDisplayEnhancer = {
      enhanceForDisplay: jest.fn((traits) => traits),
      generateExportFilename: jest.fn(),
      formatForExport: jest.fn(),
    };

    // Create mock LLM services matching actual TraitsGenerator dependencies
    mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(),
      setActiveConfiguration: jest.fn(),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn(),
    };

    // Mock traits response data
    const mockTraitsResponse = {
      names: [{ name: 'Kael the Lost', justification: 'Evokes mystery' }],
      physicalDescription: 'Weathered traveler with distant eyes',
      personality: [
        { trait: 'Contemplative', explanation: 'Always seeking answers' },
      ],
      strengths: ['Empathetic', 'Resourceful'],
      weaknesses: ['Distrustful', 'Restless'],
      likes: ['Starry nights', 'Old maps'],
      dislikes: ['Crowds', 'Deception'],
      fears: ['Never finding home'],
      goals: {
        shortTerm: ['Find the next clue'],
        longTerm: 'Recover all memories',
      },
      notes: ['Carries a mysterious compass'],
      profile: 'A soul searching for identity',
      secrets: ['Dreams of a burning tower'],
    };

    // Set up mock returns
    mockLlmJsonService.clean.mockReturnValue('{"cleaned": "json"}');
    mockLlmJsonService.parseAndRepair.mockResolvedValue(mockTraitsResponse);
    mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
      JSON.stringify(mockTraitsResponse)
    );
    mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
      configId: 'gpt-4',
      model: 'gpt-4',
    });
    mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(true);
    mockTokenEstimator.estimateTokens.mockResolvedValue(1500);

    // Create a fully mocked TraitsGenerator to avoid async issues
    mockTraitsGenerator = {
      generateTraits: jest.fn().mockResolvedValue({
        ...mockTraitsResponse,
        metadata: {
          totalTokens: 1500,
          processingTime: 2000,
          promptVersion: '1.0.0',
        },
      }),
      getLLMParameters: jest.fn().mockReturnValue({}),
      getPromptVersionInfo: jest.fn().mockReturnValue({ version: '1.0.0' }),
    };

    // Mock the database operations
    const mockDirectionDB = {
      getAll: jest.fn().mockResolvedValue([mockDirectionWithConcept.direction]),
      get: jest.fn().mockResolvedValue(mockDirectionWithConcept.direction),
    };

    const mockConceptDB = {
      get: jest.fn().mockResolvedValue(mockDirectionWithConcept.concept),
    };

    const mockCoreMotivationDB = {
      getByDirectionId: jest.fn().mockResolvedValue(mockCoreMotivations),
    };

    const mockClicheDB = {
      getByDirectionId: jest.fn().mockResolvedValue(mockCliches),
    };

    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      traitsGenerator: mockTraitsGenerator,
    });

    // Mock the service methods used by the controller
    characterBuilderService.hasClichesForDirection = jest
      .fn()
      .mockResolvedValue(true);
    characterBuilderService.getCoreMotivationsByDirectionId = jest
      .fn()
      .mockResolvedValue(mockCoreMotivations);
    characterBuilderService.getClichesByDirectionId = jest
      .fn()
      .mockResolvedValue(mockCliches[0]);

    const createControllerDependencies = () => {
      const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
        logger: mockLogger,
      });

      return {
        controllerLifecycleOrchestrator: new ControllerLifecycleOrchestrator({
          logger: mockLogger,
          eventBus: mockEventBus,
        }),
        domElementManager: new DOMElementManager({
          logger: mockLogger,
          documentRef: document,
          performanceRef:
            typeof performance !== 'undefined'
              ? performance
              : { now: () => Date.now() },
          elementsRef: {},
        }),
        eventListenerRegistry: new EventListenerRegistry({
          logger: mockLogger,
          asyncUtilities: asyncUtilitiesToolkit,
        }),
        asyncUtilitiesToolkit,
        performanceMonitor: new PerformanceMonitor({
          logger: mockLogger,
          eventBus: mockEventBus,
        }),
        memoryManager: new MemoryManager({ logger: mockLogger }),
        errorHandlingStrategy: new ErrorHandlingStrategy({
          logger: mockLogger,
          eventBus: mockEventBus,
          controllerName: 'TraitsGeneratorController',
          errorCategories: ERROR_CATEGORIES,
          errorSeverity: ERROR_SEVERITY,
        }),
        validationService: new ValidationService({
          schemaValidator: mockSchemaValidator,
          logger: mockLogger,
          handleError: (error) => {
            throw error;
          },
          errorCategories: ERROR_CATEGORIES,
        }),
      };
    };

    createControllerInstance = (service = characterBuilderService) => {
      return new TraitsGeneratorController({
        logger: mockLogger,
        characterBuilderService: service,
        eventBus: mockEventBus,
        traitsDisplayEnhancer: mockTraitsDisplayEnhancer,
        schemaValidator: mockSchemaValidator,
        ...createControllerDependencies(),
      });
    };

    // Create controller with real service
    controller = createControllerInstance();
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  it('should successfully generate traits with proper concept handling', async () => {
    // Initialize the controller
    await controller.initialize();

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify direction was added to selector
    const selector = document.getElementById('direction-selector');
    expect(selector.options.length).toBe(2); // placeholder + 1 direction

    // Select the direction
    const option = selector.options[1];
    expect(option.value).toBe('dir-123');
    expect(option.textContent).toContain("Wanderer's Path");

    selector.value = 'dir-123';
    selector.dispatchEvent(new Event('change'));

    // Wait for async direction loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fill in user inputs
    document.getElementById('core-motivation-input').value =
      'To find purpose in the journey';
    document.getElementById('internal-contradiction-input').value =
      'Wants to settle but cannot stay still';
    document.getElementById('central-question-input').value =
      'What defines home?';

    // Enable and click generate button
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.click();

    // Wait for generation to complete with longer timeout and additional async ticks
    await new Promise((resolve) => setTimeout(resolve, 500));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => process.nextTick(resolve));

    // Clean up temp logging
    // console.log('All dispatched events:', mockEventBus.dispatch.mock.calls);
    // console.log('Error logs:', mockLogger.error.mock.calls);

    // Verify the traits generator was called
    expect(mockTraitsGenerator.generateTraits).toHaveBeenCalled();

    // Verify success event was dispatched
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generated',
      expect.objectContaining({
        directionId: 'dir-123',
        success: true,
        traitsCount: expect.any(Number),
      })
    );

    // Verify no error was logged
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should handle missing concept gracefully', async () => {
    // Mock a direction without a concept
    const directionWithoutConcept = {
      direction: mockDirectionWithConcept.direction,
      concept: null,
    };

    const mockDirectionDB = {
      getAll: jest.fn().mockResolvedValue([directionWithoutConcept.direction]),
      get: jest.fn().mockResolvedValue(directionWithoutConcept.direction),
    };

    const mockConceptDB = {
      get: jest.fn().mockResolvedValue(null), // Concept not found
    };

    // Recreate service with concept that returns null
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      thematicDirectionDatabase: mockDirectionDB,
      clicheDatabase: {
        getByDirectionId: jest.fn().mockResolvedValue(mockCliches),
      },
      characterConceptDatabase: mockConceptDB,
      coreMotivationDatabase: {
        getByDirectionId: jest.fn().mockResolvedValue(mockCoreMotivations),
      },
      traitsGenerator: mockTraitsGenerator,
    });

    // Recreate controller
    controller = createControllerInstance(characterBuilderService);

    await controller.initialize();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The direction with null concept should not be available in the selector
    const selector = document.getElementById('direction-selector');
    expect(selector.options.length).toBe(1); // Only placeholder, no valid directions

    // Verify that some logging occurred (the specific message may vary based on implementation)
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should validate concept structure before generation', async () => {
    // Test with a malformed concept (missing required fields)
    const malformedConcept = {
      direction: mockDirectionWithConcept.direction,
      concept: {
        id: 'concept-bad',
        // Missing 'concept' text field
        name: 'Bad Concept',
      },
    };

    const mockConceptDB = {
      get: jest.fn().mockResolvedValue(malformedConcept.concept),
    };

    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      thematicDirectionDatabase: {
        getAll: jest.fn().mockResolvedValue([malformedConcept.direction]),
        get: jest.fn().mockResolvedValue(malformedConcept.direction),
      },
      clicheDatabase: {
        getByDirectionId: jest.fn().mockResolvedValue(mockCliches),
      },
      characterConceptDatabase: mockConceptDB,
      coreMotivationDatabase: {
        getByDirectionId: jest.fn().mockResolvedValue(mockCoreMotivations),
      },
      traitsGenerator: mockTraitsGenerator,
    });

    controller = createControllerInstance(characterBuilderService);

    await controller.initialize();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The direction with malformed concept should not be available
    const selector = document.getElementById('direction-selector');
    expect(selector.options.length).toBe(1); // Only placeholder

    // Verify warning about filtering
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
