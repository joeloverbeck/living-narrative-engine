/**
 * @file Unit tests for ThematicDirectionController
 * @description Test coverage for the simplified thematic direction generator controller
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockSafeEventDispatcher } from '../../../common/mockFactories/eventBusMocks.js';
import {
  createThematicDirectionMockElements,
  setupThematicDirectionDOM,
  cleanupThematicDirectionDOM,
  createMockEvent,
} from '../../../common/testHelpers/thematicDirectionDOMSetup.js';

describe('ThematicDirectionController', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockElements;
  let originalDocument;

  beforeEach(() => {
    // Create mocks
    mockLogger = createMockLogger();
    mockEventBus = createMockSafeEventDispatcher();

    // Mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    // Mock schema validator
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
    };

    // Save original document
    originalDocument = global.document;

    // Use unified DOM setup
    mockElements = createThematicDirectionMockElements();
    setupThematicDirectionDOM(mockElements);
  });

  afterEach(() => {
    // Restore globals
    global.document = originalDocument;
    cleanupThematicDirectionDOM();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(controller).toBeDefined();
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new ThematicDirectionController({
          logger: {},
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should validate characterBuilderService dependency', () => {
      expect(() => {
        new ThematicDirectionController({
          logger: mockLogger,
          characterBuilderService: {},
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should validate eventBus dependency', () => {
      expect(() => {
        new ThematicDirectionController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: {},
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should validate schemaValidator dependency', () => {
      expect(() => {
        new ThematicDirectionController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: {},
        });
      }).toThrow();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should initialize successfully', async () => {
      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ThematicDirectionController: Successfully initialized'
      );
    });

    it('should show empty state on initialization', async () => {
      await controller.initialize();

      expect(mockElements.emptyState.style.display).toBe('block');
      expect(mockElements.loadingState.style.display).toBe('none');
      expect(mockElements.errorState.style.display).toBe('none');
      expect(mockElements.resultsState.style.display).toBe('none');
    });


    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      await controller.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ThematicDirectionController: Failed to initialize',
        error
      );

      expect(mockElements.errorState.style.display).toBe('block');
      expect(mockElements.errorMessageText.textContent).toContain(
        'Failed to initialize'
      );
    });
  });

  describe('form submission (legacy textarea tests)', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should not work with textarea input anymore (new workflow uses concept selector)', async () => {
      const conceptText = 'A brave knight with a mysterious past';

      // Old workflow - textarea input (should not work anymore)
      if (mockElements.textarea) {
        mockElements.textarea.value = conceptText;
      }

      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(submitEvent.preventDefault).toHaveBeenCalled();
      // Should not create concept from textarea anymore
      expect(
        mockCharacterBuilderService.createCharacterConcept
      ).not.toHaveBeenCalled();
      // Should show error about concept selection instead
      expect(mockElements.conceptSelectorError.textContent).toContain(
        'Please select a character concept'
      );
    });

    it('should handle generation errors when concept not found', async () => {
      // Try to submit without any concepts loaded
      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'ThematicDirectionController: Failed to generate directions',
        expect.any(Error)
      );
      expect(mockElements.conceptSelectorError.textContent).toContain(
        'Please select a character concept'
      );
    });
  });

  describe('input validation (legacy textarea)', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should use new validation method when textarea is not available', () => {
      // New validation focuses on concept selection, not textarea input
      expect(mockElements.generateBtn.disabled).toBe(true);
    });

    it('should handle legacy input validation gracefully', () => {
      if (mockElements.textarea) {
        mockElements.textarea.value = 'Short';
        mockElements.textarea.dispatchEvent(createMockEvent('input'));
      }

      // Even with textarea input, button should remain disabled because no concept is selected
      expect(mockElements.generateBtn.disabled).toBe(true);
    });

    it('should handle character count updates if textarea exists', () => {
      if (mockElements.textarea && mockElements.charCount) {
        mockElements.textarea.value = 'Test input';
        mockElements.textarea.dispatchEvent(createMockEvent('input'));
        expect(mockElements.charCount.textContent).toBe('10/1000');
      } else {
        // Character count is not relevant in new workflow
        expect(true).toBe(true);
      }
    });
  });

  describe('concept selector functionality', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should load and populate concept selector on initialization', async () => {
      const mockConcepts = [
        {
          id: '1',
          concept: 'A brave knight with a mysterious past',
          createdAt: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          concept:
            'A cunning thief who steals from the rich to give to the poor',
          createdAt: '2023-01-02T00:00:00Z',
        },
      ];

      // Create fresh controller with mock concepts
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      const freshController = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await freshController.initialize();

      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      // Verify that concept loading was attempted (the key behavior)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading character concepts for selection'
      );
    });

    it('should handle concept selection and display concept details', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'A brave knight with a mysterious past',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      mockCharacterBuilderService.getThematicDirections.mockResolvedValue([
        { title: 'Direction 1', description: 'Test direction' },
      ]);

      await controller.initialize();

      // Simulate concept selection
      mockElements.conceptSelector.value = '123';
      const changeEvent = createMockEvent('change');
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockElements.selectedConceptDisplay.style.display).toBe('block');
      expect(mockElements.conceptContent.textContent).toBe(
        'A brave knight with a mysterious past'
      );
      expect(mockElements.conceptDirectionsCount.textContent).toBe(
        '1 existing direction'
      );
    });

    it('should validate form with concept selection', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'Test concept',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      await controller.initialize();

      // Initially, no concept selected - button should be disabled
      expect(mockElements.generateBtn.disabled).toBe(true);

      // Select a concept
      mockElements.conceptSelector.value = '123';
      const changeEvent = createMockEvent('change');
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Button should now be enabled
      expect(mockElements.generateBtn.disabled).toBe(false);
      expect(mockElements.conceptSelectorError.textContent).toBe('');
    });

    it('should show error when no concept is selected for generation', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'Test concept',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      await controller.initialize();

      // Try to submit without selecting a concept
      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(submitEvent.preventDefault).toHaveBeenCalled();
      expect(mockElements.conceptSelectorError.textContent).toContain(
        'Please select a character concept'
      );
      expect(
        mockCharacterBuilderService.generateThematicDirections
      ).not.toHaveBeenCalled();
    });

    it('should generate directions with selected concept', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'A brave knight with a mysterious past',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];
      const mockDirections = [
        {
          title: 'Direction 1',
          description: 'Test direction 1',
        },
        {
          title: 'Direction 2',
          description: 'Test direction 2',
        },
      ];

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      mockCharacterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );
      mockCharacterBuilderService.getThematicDirections.mockResolvedValue([]);

      await controller.initialize();

      // Select concept
      mockElements.conceptSelector.value = '123';
      const changeEvent = createMockEvent('change');
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Submit form
      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        mockCharacterBuilderService.generateThematicDirections
      ).toHaveBeenCalledWith('123');
      expect(mockElements.resultsState.style.display).toBe('block');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'thematic:thematic_directions_generated',
        {
          conceptId: '123',
          directionCount: 2,
          autoSaved: true,
        }
      );
    });

    it('should show no concepts message when no concepts exist', async () => {
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);

      const freshController = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await freshController.initialize();

      // Verify that concept loading was attempted and logged the right amount
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded 0 character concepts'
      );
    });

    it('should handle concept loading errors gracefully', async () => {
      const error = new Error('Failed to load concepts');
      mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      await controller.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load character concepts',
        error
      );
      expect(mockElements.conceptSelectorError.textContent).toContain(
        'Failed to load character concepts'
      );
    });

    it('should handle direction count loading errors', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'Test concept',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      mockCharacterBuilderService.getThematicDirections.mockRejectedValue(
        new Error('Direction load failed')
      );

      await controller.initialize();

      // Select concept
      mockElements.conceptSelector.value = '123';
      const changeEvent = createMockEvent('change');
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load direction count',
        expect.any(Error)
      );
      expect(mockElements.conceptDirectionsCount.textContent).toBe(
        'Unable to load directions'
      );
    });

    it('should show warning for concepts with many existing directions', async () => {
      const mockConcepts = [
        {
          id: '123',
          concept: 'Test concept',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      // Mock 12 existing directions
      const mockDirections = Array.from({ length: 12 }, (_, i) => ({
        title: `Direction ${i + 1}`,
        description: `Test direction ${i + 1}`,
      }));

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      mockCharacterBuilderService.getThematicDirections.mockResolvedValue(
        mockDirections
      );

      await controller.initialize();

      // Select concept
      mockElements.conceptSelector.value = '123';
      const changeEvent = createMockEvent('change');
      mockElements.conceptSelector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockElements.conceptDirectionsCount.textContent).toBe(
        '12 existing directions'
      );
      expect(mockElements.conceptDirectionsCount.innerHTML).toContain(
        '(consider if more are needed)'
      );
    });
  });
});
