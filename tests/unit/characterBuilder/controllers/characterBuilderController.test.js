/**
 * @file Unit tests for CharacterBuilderController
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { CharacterBuilderController } from '../../../../src/characterBuilder/controllers/characterBuilderController.js';

/**
 * @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../../src/characterBuilder/services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

describe('CharacterBuilderController', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<CharacterBuilderService>} */
  let mockCharacterBuilderService;
  /** @type {jest.Mocked<ISafeEventDispatcher>} */
  let mockEventBus;
  /** @type {CharacterBuilderController} */
  let controller;

  // Mock DOM elements
  let mockForm;
  let mockNameInput;
  let mockDescriptionInput;
  let mockGenerateButton;
  let mockResultsContainer;
  let mockErrorContainer;

  beforeEach(() => {
    // Setup DOM mocks
    mockForm = {
      addEventListener: jest.fn(),
      reset: jest.fn(),
    };

    mockNameInput = {
      value: '',
      addEventListener: jest.fn(),
      focus: jest.fn(),
    };

    mockDescriptionInput = {
      value: '',
      addEventListener: jest.fn(),
    };

    mockGenerateButton = {
      disabled: false,
      textContent: 'Generate Directions',
      addEventListener: jest.fn(),
    };

    mockResultsContainer = {
      innerHTML: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockErrorContainer = {
      innerHTML: '',
      style: { display: 'none' },
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    // Mock document.getElementById
    global.document = {
      getElementById: jest.fn((id) => {
        switch (id) {
          case 'character-concept-form':
            return mockForm;
          case 'character-name':
            return mockNameInput;
          case 'character-description':
            return mockDescriptionInput;
          case 'generate-directions':
            return mockGenerateButton;
          case 'thematic-directions-results':
            return mockResultsContainer;
          case 'error-container':
            return mockErrorContainer;
          default:
            return null;
        }
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getCharacterConcept: jest.fn(),
      getThematicDirections: jest.fn(),
      listCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    controller = new CharacterBuilderController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.document;
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(controller).toBeInstanceOf(CharacterBuilderController);
    });

    test('should throw error if logger is invalid', () => {
      expect(() => {
        new CharacterBuilderController({
          logger: null,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });

    test('should throw error if characterBuilderService is invalid', () => {
      expect(() => {
        new CharacterBuilderController({
          logger: mockLogger,
          characterBuilderService: null,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: CharacterBuilderService.');
    });

    test('should throw error if eventBus is invalid', () => {
      expect(() => {
        new CharacterBuilderController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: null,
        });
      }).toThrow('Missing required dependency: ISafeEventDispatcher.');
    });
  });

  describe('initialize', () => {
    test('should initialize DOM elements and event listeners', async () => {
      await controller.initialize();

      expect(global.document.getElementById).toHaveBeenCalledWith('character-concept-form');
      expect(global.document.getElementById).toHaveBeenCalledWith('character-name');
      expect(global.document.getElementById).toHaveBeenCalledWith('character-description');
      expect(global.document.getElementById).toHaveBeenCalledWith('generate-directions');
      expect(mockForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('CharacterBuilderController: Successfully initialized');
    });

    test('should throw error if required DOM elements not found', async () => {
      global.document.getElementById = jest.fn(() => null);

      await expect(controller.initialize()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize'),
        expect.any(Object)
      );
    });
  });

  describe('form submission handling', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    test('should handle successful form submission', async () => {
      const mockConcept = {
        id: 'concept-123',
        name: 'Test Hero',
        description: 'A brave adventurer',
        createdAt: new Date().toISOString(),
      };

      const mockDirections = [
        {
          id: 'direction-1',
          conceptId: 'concept-123',
          title: 'The Hero\'s Journey',
          description: 'Classic heroic arc',
          coreTension: 'Duty vs. personal desires',
          uniqueTwist: 'Hidden nobility',
          narrativePotential: 'Epic adventures',
        },
      ];

      mockNameInput.value = 'Test Hero';
      mockDescriptionInput.value = 'A brave adventurer with a mysterious past';
      mockCharacterBuilderService.createCharacterConcept.mockResolvedValue(mockConcept);
      mockCharacterBuilderService.generateThematicDirections.mockResolvedValue(mockDirections);

      // Get the form submit handler and call it
      const submitHandler = mockForm.addEventListener.mock.calls.find(
        call => call[0] === 'submit'
      )[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      await submitHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockCharacterBuilderService.createCharacterConcept).toHaveBeenCalledWith({
        name: 'Test Hero',
        description: 'A brave adventurer with a mysterious past',
        background: '',
        personality: '',
      });
      expect(mockCharacterBuilderService.generateThematicDirections).toHaveBeenCalledWith(
        mockConcept.id
      );
      expect(mockResultsContainer.innerHTML).toContain('Test Hero');
      expect(mockResultsContainer.innerHTML).toContain('The Hero\'s Journey');
    });

    test('should handle form validation errors', async () => {
      mockNameInput.value = '';
      mockDescriptionInput.value = '';

      const submitHandler = mockForm.addEventListener.mock.calls.find(
        call => call[0] === 'submit'
      )[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      await submitHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockCharacterBuilderService.createCharacterConcept).not.toHaveBeenCalled();
      expect(mockErrorContainer.innerHTML).toContain('Character name is required');
      expect(mockErrorContainer.style.display).not.toBe('none');
    });

    test('should handle service errors gracefully', async () => {
      mockNameInput.value = 'Test Hero';
      mockDescriptionInput.value = 'A brave adventurer';

      const serviceError = new Error('Service unavailable');
      mockCharacterBuilderService.createCharacterConcept.mockRejectedValue(serviceError);

      const submitHandler = mockForm.addEventListener.mock.calls.find(
        call => call[0] === 'submit'
      )[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      await submitHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockErrorContainer.innerHTML).toContain('Failed to create character concept');
      expect(mockErrorContainer.style.display).not.toBe('none');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling form submission'),
        expect.any(Object)
      );
    });

    test('should disable form during processing', async () => {
      mockNameInput.value = 'Test Hero';
      mockDescriptionInput.value = 'A brave adventurer';

      // Mock slow service response
      mockCharacterBuilderService.createCharacterConcept.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          id: 'concept-123',
          name: 'Test Hero',
          description: 'A brave adventurer',
        }), 100))
      );

      const submitHandler = mockForm.addEventListener.mock.calls.find(
        call => call[0] === 'submit'
      )[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      const submissionPromise = submitHandler(mockEvent);

      // Check that button is disabled during processing
      expect(mockGenerateButton.disabled).toBe(true);
      expect(mockGenerateButton.textContent).toBe('Generating...');

      await submissionPromise;

      // Check that button is re-enabled after processing
      expect(mockGenerateButton.disabled).toBe(false);
      expect(mockGenerateButton.textContent).toBe('Generate Directions');
    });
  });

  describe('UI state management', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    test('should show loading state', () => {
      // Access private method through controller instance
      controller._setLoadingState(true);

      expect(mockGenerateButton.disabled).toBe(true);
      expect(mockGenerateButton.textContent).toBe('Generating...');
    });

    test('should hide loading state', () => {
      controller._setLoadingState(false);

      expect(mockGenerateButton.disabled).toBe(false);
      expect(mockGenerateButton.textContent).toBe('Generate Directions');
    });

    test('should show error message', () => {
      const errorMessage = 'Test error message';
      controller._showError(errorMessage);

      expect(mockErrorContainer.innerHTML).toContain(errorMessage);
      expect(mockErrorContainer.style.display).not.toBe('none');
    });

    test('should clear error message', () => {
      controller._clearError();

      expect(mockErrorContainer.innerHTML).toBe('');
      expect(mockErrorContainer.style.display).toBe('none');
    });

    test('should render thematic directions', () => {
      const mockConcept = {
        id: 'concept-123',
        name: 'Test Hero',
        description: 'A brave adventurer',
      };

      const mockDirections = [
        {
          id: 'direction-1',
          conceptId: 'concept-123',
          title: 'The Hero\'s Journey',
          description: 'A character destined for greatness',
          coreTension: 'Duty vs. personal desires',
          uniqueTwist: 'Hidden royal blood',
          narrativePotential: 'Epic quests and moral dilemmas',
        },
      ];

      controller._renderResults(mockConcept, mockDirections);

      expect(mockResultsContainer.innerHTML).toContain('Test Hero');
      expect(mockResultsContainer.innerHTML).toContain('The Hero\'s Journey');
      expect(mockResultsContainer.innerHTML).toContain('A character destined for greatness');
      expect(mockResultsContainer.innerHTML).toContain('Duty vs. personal desires');
      expect(mockResultsContainer.innerHTML).toContain('Hidden royal blood');
      expect(mockResultsContainer.innerHTML).toContain('Epic quests and moral dilemmas');
    });
  });

  describe('form validation', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    test('should validate required fields', () => {
      const validationResult = controller._validateForm({
        name: '',
        description: 'Valid description',
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Character name is required');
    });

    test('should validate field lengths', () => {
      const longName = 'a'.repeat(101); // Assuming max length is 100
      const validationResult = controller._validateForm({
        name: longName,
        description: 'Valid description',
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.some(error => error.includes('too long'))).toBe(true);
    });

    test('should pass validation for valid input', () => {
      const validationResult = controller._validateForm({
        name: 'Valid Hero Name',
        description: 'A valid character description',
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    test('should dispatch events for successful generation', async () => {
      const mockConcept = {
        id: 'concept-123',
        name: 'Test Hero',
      };

      const mockDirections = [
        { id: 'direction-1', title: 'Test Direction' },
      ];

      controller._handleSuccessfulGeneration(mockConcept, mockDirections);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_BUILDER_GENERATION_COMPLETED',
        payload: {
          conceptId: mockConcept.id,
          directionCount: mockDirections.length,
          timestamp: expect.any(String),
        },
      });
    });

    test('should dispatch events for generation errors', () => {
      const error = new Error('Test error');
      controller._handleGenerationError(error);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_BUILDER_GENERATION_FAILED',
        payload: {
          error: error.message,
          timestamp: expect.any(String),
        },
      });
    });
  });
});