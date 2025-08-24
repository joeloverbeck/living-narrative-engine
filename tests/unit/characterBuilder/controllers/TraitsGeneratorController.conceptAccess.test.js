/**
 * @file Unit test to verify proper concept handling in TraitsGeneratorController
 * @description Tests that the controller correctly stores and accesses concept data when generating traits
 * @see ../../../../src/characterBuilder/controllers/TraitsGeneratorController.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsGeneratorController } from '../../../../src/characterBuilder/controllers/TraitsGeneratorController.js';

describe('TraitsGeneratorController - Concept Access', () => {
  let mockCharacterBuilderService;
  let mockTraitsDisplayEnhancer;
  let mockEventBus;
  let mockLogger;
  let mockUIStateManager;
  let mockSchemaValidator;
  let controller;
  let container;

  // Mock data matching the structure from getAllThematicDirectionsWithConcepts
  const mockDirectionWithConcept = {
    direction: {
      id: 'dir-123',
      title: 'Test Direction',
      description: 'Test description',
      conceptId: 'concept-456',
      coreTension: 'Test tension',
      uniqueTwist: 'Test twist',
      narrativePotential: 'Test potential',
    },
    concept: {
      id: 'concept-456',
      concept: 'A mysterious wanderer with a hidden past',
      name: 'Mysterious Wanderer',
    },
  };

  const mockDirectionWithNullConcept = {
    direction: {
      id: 'dir-789',
      title: 'Direction Without Concept',
      description: 'This direction has no associated concept',
      conceptId: 'missing-concept',
      coreTension: 'Test tension',
      uniqueTwist: 'Test twist',
      narrativePotential: 'Test potential',
    },
    concept: null, // This is the problematic case
  };

  const mockCoreMotivations = [
    {
      id: 'motivation-1',
      coreDesire: 'To find redemption',
      internalContradiction: 'Wants to help but fears discovery',
      centralQuestion: 'Can someone truly change?',
    },
  ];

  // Mock Cliche object structure (not an array)
  const mockCliches = {
    id: 'cliche-1',
    directionId: 'dir-123',
    conceptId: 'concept-456',
    categories: {
      names: ['Generic fantasy names'],
    },
    tropesAndStereotypes: [],
    createdAt: '2023-01-01T00:00:00.000Z',
    llmMetadata: {
      model: 'test-model',
      temperature: 0.8,
      tokens: 100,
      responseTime: 1000,
      promptVersion: '1.0',
    },
  };

  beforeEach(() => {
    // Create mock services
    mockCharacterBuilderService = {
      // Required methods for BaseCharacterBuilderController
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      // Methods for TraitsGeneratorController
      getAllThematicDirectionsWithConcepts: jest.fn(),
      hasClichesForDirection: jest.fn(),
      getCoreMotivationsByDirectionId: jest.fn(),
      getClichesByDirectionId: jest.fn(),
      generateTraits: jest.fn(),
    };

    mockTraitsDisplayEnhancer = {
      enhanceForDisplay: jest.fn(),
      generateExportFilename: jest.fn(),
      formatForExport: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockUIStateManager = {
      showState: jest.fn(),
      hideState: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn(),
      validateAsync: jest.fn(),
      validateAgainstSchema: jest.fn(),
    };

    // Create a simple mock container for DOM operations
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
    `;
    document.body.appendChild(container);

    // Mock scrollIntoView method for JSDOM
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Concept handling during direction selection', () => {
    beforeEach(() => {
      controller = new TraitsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        uiStateManager: mockUIStateManager,
        traitsDisplayEnhancer: mockTraitsDisplayEnhancer,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should correctly store concept when direction is selected', async () => {
      // Setup: Direction with valid concept
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [mockDirectionWithConcept]
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockCoreMotivations
      );

      // Initialize controller
      await controller.initialize();

      // Simulate selecting a direction
      const selector = document.getElementById('direction-selector');
      const option = document.createElement('option');
      option.value = 'dir-123';
      option.textContent = 'Test Direction';
      selector.appendChild(option);

      selector.value = 'dir-123';
      selector.dispatchEvent(new Event('change'));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now try to generate traits with user inputs
      document.getElementById('core-motivation-input').value =
        'Test motivation';
      document.getElementById('internal-contradiction-input').value =
        'Test contradiction';
      document.getElementById('central-question-input').value =
        'Test question?';

      // Mock the cliches response
      mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        mockCliches
      );

      // Mock the traits generation response
      const mockTraitsResponse = {
        names: [{ name: 'Test Name', justification: 'Test' }],
        physicalDescription: 'Test description',
        personality: [{ trait: 'Test trait', explanation: 'Test' }],
        strengths: ['Strength 1'],
        weaknesses: ['Weakness 1'],
        likes: ['Like 1'],
        dislikes: ['Dislike 1'],
        fears: ['Fear 1'],
        goals: { shortTerm: ['Goal 1'], longTerm: 'Long term goal' },
        notes: ['Note 1'],
        profile: 'Test profile',
        secrets: ['Secret 1'],
      };
      mockCharacterBuilderService.generateTraits.mockResolvedValue(
        mockTraitsResponse
      );
      mockTraitsDisplayEnhancer.enhanceForDisplay.mockReturnValue(
        mockTraitsResponse
      );

      // Enable the generate button
      document.getElementById('generate-btn').disabled = false;

      // Click generate button
      document.getElementById('generate-btn').click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that generateTraits was called with the correct concept
      // Note: cliches will be converted from Cliche object to array format by #convertClicheToArray
      expect(mockCharacterBuilderService.generateTraits).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: mockDirectionWithConcept.concept, // Should pass the actual concept object
          direction: mockDirectionWithConcept.direction,
          userInputs: {
            coreMotivation: 'Test motivation',
            internalContradiction: 'Test contradiction',
            centralQuestion: 'Test question?',
          },
          cliches: [
            {
              id: 'cliche-1',
              category: 'names',
              content: 'Generic fantasy names',
            },
          ],
        })
      );
    });

    it('should prevent generation when direction has null concept by filtering it out', async () => {
      // Setup: Direction with null concept should be filtered out
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [mockDirectionWithNullConcept]
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockCoreMotivations
      );

      // Initialize controller
      await controller.initialize();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that the direction with null concept is NOT available in the selector
      const selector = document.getElementById('direction-selector');
      const options = Array.from(selector.options);

      // Should only have placeholder option since null concept direction was filtered out
      expect(options.length).toBe(1); // Only placeholder
      expect(options[0].value).toBe('');

      // The direction with null concept should not be available for selection
      const invalidOption = options.find((opt) => opt.value === 'dir-789');
      expect(invalidOption).toBeUndefined();

      // Since no valid directions are available, generateTraits should never be called
      expect(mockCharacterBuilderService.generateTraits).not.toHaveBeenCalled();
    });

    it('should filter out directions with null concepts during loading', async () => {
      // Setup: Mix of directions with and without concepts
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [mockDirectionWithConcept, mockDirectionWithNullConcept]
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockCoreMotivations
      );

      // Initialize controller
      await controller.initialize();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that only the direction with a valid concept is available
      const selector = document.getElementById('direction-selector');
      const options = Array.from(selector.options);

      // Should have the placeholder option and the valid direction
      expect(options.length).toBe(2); // placeholder + 1 valid direction
      expect(options[1].value).toBe('dir-123');
      expect(options[1].textContent).toContain('Test Direction');

      // The direction with null concept should not be available
      const invalidOption = options.find((opt) => opt.value === 'dir-789');
      expect(invalidOption).toBeUndefined();
    });
  });

  describe('Error handling for missing concept', () => {
    beforeEach(() => {
      controller = new TraitsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        uiStateManager: mockUIStateManager,
        traitsDisplayEnhancer: mockTraitsDisplayEnhancer,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should handle TraitsGenerationError when concept is invalid', async () => {
      // Setup: Direction with valid concept initially
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [mockDirectionWithConcept]
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockCoreMotivations
      );
      mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        mockCliches
      );

      // Make generateTraits throw the validation error we see in the logs
      mockCharacterBuilderService.generateTraits.mockRejectedValue(
        new Error('Validation failed for concept: must be a valid object')
      );

      // Initialize controller
      await controller.initialize();

      // Select direction and fill inputs
      const selector = document.getElementById('direction-selector');
      const option = document.createElement('option');
      option.value = 'dir-123';
      option.textContent = 'Test Direction';
      selector.appendChild(option);
      selector.value = 'dir-123';
      selector.dispatchEvent(new Event('change'));

      await new Promise((resolve) => setTimeout(resolve, 100));

      document.getElementById('core-motivation-input').value =
        'Test motivation';
      document.getElementById('internal-contradiction-input').value =
        'Test contradiction';
      document.getElementById('central-question-input').value =
        'Test question?';
      document.getElementById('generate-btn').disabled = false;

      // Try to generate
      document.getElementById('generate-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Traits generation failed'),
        expect.any(Error)
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:traits_generation_failed',
        expect.objectContaining({
          directionId: 'dir-123',
          error: expect.stringContaining('Validation failed for concept'),
        })
      );
    });
  });
});
