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

    it('should load previous concepts on initialization', async () => {
      const mockConcepts = [
        { id: '1', concept: 'Test concept 1' },
        { id: '2', concept: 'Test concept 2' },
      ];
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await controller.initialize();

      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      expect(mockElements.previousConceptsSelect.children.length).toBe(3); // Default option + 2 concepts
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

  describe('form submission', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should generate thematic directions on valid submission', async () => {
      const conceptText = 'A brave knight with a mysterious past';
      const mockConcept = { id: '123', concept: conceptText }; // Fixed: use 'concept' not 'conceptText'
      const mockDirections = [
        { title: 'Direction 1', description: 'Narrative 1', themes: ['Theme1'] }, // Fixed: use 'description' not 'narrative'
        { title: 'Direction 2', description: 'Narrative 2', themes: ['Theme2'] },
      ];

      mockCharacterBuilderService.createCharacterConcept.mockResolvedValue(
        mockConcept
      );
      mockCharacterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      // Set textarea value and submit form
      mockElements.textarea.value = conceptText;
      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(submitEvent.preventDefault).toHaveBeenCalled();
      expect(
        mockCharacterBuilderService.createCharacterConcept
      ).toHaveBeenCalledWith(conceptText);
      expect(
        mockCharacterBuilderService.generateThematicDirections
      ).toHaveBeenCalledWith(mockConcept.id); // Fixed: pass id, not whole object
      expect(mockElements.resultsState.style.display).toBe('block');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'THEMATIC_DIRECTIONS_GENERATED',
        payload: {
          conceptId: '123',
          directionsCount: 2,
        },
      });
    });

    it('should show error for invalid input', async () => {
      mockElements.textarea.value = 'Short'; // Less than 10 characters
      mockElements.generateBtn.disabled = true;

      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        mockCharacterBuilderService.createCharacterConcept
      ).not.toHaveBeenCalled();
      expect(mockElements.errorMessage.textContent).toContain(
        'at least 10 characters'
      );
    });

    it('should handle generation errors', async () => {
      const conceptText = 'A brave knight with a mysterious past';
      const error = new Error('Generation failed');

      mockCharacterBuilderService.createCharacterConcept.mockRejectedValue(
        error
      );

      mockElements.textarea.value = conceptText;
      const submitEvent = createMockEvent('submit');
      mockElements.form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ThematicDirectionController: Failed to generate directions',
        error
      );
      expect(mockElements.errorState.style.display).toBe('block');
      expect(mockElements.errorMessageText.textContent).toBe(
        'Generation failed'
      );
    });
  });

  describe('input validation', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should enable generate button for valid input', () => {
      mockElements.textarea.value = 'Valid character concept text';
      mockElements.textarea.dispatchEvent(createMockEvent('input'));

      expect(mockElements.generateBtn.disabled).toBe(false);
      expect(mockElements.errorMessage.textContent).toBe('');
    });

    it('should disable generate button for short input', () => {
      mockElements.textarea.value = 'Short';
      mockElements.textarea.dispatchEvent(createMockEvent('input'));

      expect(mockElements.generateBtn.disabled).toBe(true);
      expect(mockElements.errorMessage.textContent).toContain(
        'at least 10 characters'
      );
    });

    it('should disable generate button for too long input', () => {
      mockElements.textarea.value = 'a'.repeat(1001);
      mockElements.textarea.dispatchEvent(createMockEvent('input'));

      expect(mockElements.generateBtn.disabled).toBe(true);
      expect(mockElements.errorMessage.textContent).toContain('under 1000');
    });

    it('should update character count on input', () => {
      mockElements.textarea.value = 'Test input';
      mockElements.textarea.dispatchEvent(createMockEvent('input'));

      expect(mockElements.charCount.textContent).toBe('10/1000');
    });
  });

  describe('previous concepts dropdown', () => {
    beforeEach(async () => {
      controller = new ThematicDirectionController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      await controller.initialize();
    });

    it('should load selected concept into textarea', async () => {
      const mockConcept = {
        id: '123',
        concept: 'Loaded concept text',
        thematicDirections: [],
      };
      mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        mockConcept
      );

      mockElements.previousConceptsSelect.value = '123';
      const changeEvent = createMockEvent('change', { 
        target: { value: '123' } 
      });
      mockElements.previousConceptsSelect.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        mockCharacterBuilderService.getCharacterConcept
      ).toHaveBeenCalledWith('123');
      expect(mockElements.textarea.value).toBe('Loaded concept text');
    });

    it('should show existing directions when loading concept', async () => {
      const mockConcept = {
        id: '123',
        concept: 'Loaded concept text',
        thematicDirections: [
          { title: 'Direction 1', description: 'Narrative 1' },
        ],
      };
      mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        mockConcept
      );

      mockElements.previousConceptsSelect.value = '123';
      const changeEvent = createMockEvent('change', {
        target: { value: '123' }
      });
      mockElements.previousConceptsSelect.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockElements.resultsState.style.display).toBe('block');
    });

    it('should handle concept loading errors', async () => {
      mockCharacterBuilderService.getCharacterConcept.mockRejectedValue(
        new Error('Load failed')
      );

      mockElements.previousConceptsSelect.value = '123';
      mockElements.previousConceptsSelect.dispatchEvent(createMockEvent('change', {
        target: { value: '123' }
      }));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockElements.errorMessage.textContent).toContain(
        'Failed to load selected concept'
      );
    });
  });
});
