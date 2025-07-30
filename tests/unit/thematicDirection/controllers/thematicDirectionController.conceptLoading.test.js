/**
 * @file Unit tests for ThematicDirectionController concept loading functionality
 * @description Tests the specific issue where concepts are not loading in the dropdown
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { createCharacterConcept } from '../../../../src/characterBuilder/models/characterConcept.js';
import {
  createThematicDirectionMockElements,
  setupThematicDirectionDOM,
  cleanupThematicDirectionDOM,
  createMockEvent,
} from '../../../common/testHelpers/thematicDirectionDOMSetup.js';

// Legacy dropdown tests - removed as this functionality has been replaced
describe.skip('ThematicDirectionController - Concept Loading', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockElements;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
    };

    // Use unified DOM setup
    mockElements = createThematicDirectionMockElements();
    setupThematicDirectionDOM(mockElements);

    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanupThematicDirectionDOM();
  });

  describe('Concept Loading Issue Investigation', () => {
    test('should call getAllCharacterConcepts during initialization', async () => {
      // Arrange
      const mockConcepts = [
        createCharacterConcept('A brave knight'),
        createCharacterConcept('A sneaky rogue'),
      ];
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Act
      await controller.initialize();

      // Assert
      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();

      // Debug: check if warning was logged (element not found)
      const warningCalls = mockLogger.warn.mock.calls;
      if (warningCalls.length > 0) {
        console.log('Warning logged:', warningCalls[0][0]);
      }

      // Debug: check current innerHTML
      console.log(
        'Dropdown innerHTML:',
        mockElements.previousConceptsSelect.innerHTML
      );
    });

    test('should populate dropdown with retrieved concepts', async () => {
      // Arrange
      const mockConcepts = [
        createCharacterConcept('A brave knight who fights for justice'),
        createCharacterConcept('A sneaky rogue with a heart of gold'),
      ];
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Act
      await controller.initialize();

      // Assert
      expect(mockElements.previousConceptsSelect.innerHTML).toContain(
        '-- Select a saved concept --'
      );
      expect(global.document.createElement).toHaveBeenCalledWith('option');
    });

    test('should handle empty concepts list gracefully', async () => {
      // Arrange
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);

      // Act
      await controller.initialize();

      // Assert
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      expect(mockElements.previousConceptsSelect.innerHTML).toBe(
        '<option value="">-- Select a saved concept --</option>'
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should handle concept loading errors gracefully', async () => {
      // Arrange
      const error = new Error('Failed to load concepts from storage');
      mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      // Act
      await controller.initialize();

      // Assert
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ThematicDirectionController: Failed to load previous concepts',
        error
      );
      // Should not propagate error to user - dropdown remains empty
      expect(mockElements.previousConceptsSelect.innerHTML).toBe(
        '<option value="">-- Select a saved concept --</option>'
      );
    });

    test('should handle service initialization failure', async () => {
      // Arrange
      const error = new Error('Service initialization failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      // Act & Assert
      await controller.initialize();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ThematicDirectionController: Failed to initialize',
        error
      );
    });

    test('should truncate long concept text for display', async () => {
      // Arrange
      const longConceptText =
        'A very long character concept that exceeds sixty characters and should be truncated for display purposes';
      const mockConcepts = [createCharacterConcept(longConceptText)];
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Create a spy to capture the option that gets created
      const originalCreateElement = global.document.createElement;
      const mockOption = {
        value: '',
        textContent: '',
        selected: false,
        tagName: 'OPTION',
      };

      global.document.createElement = jest.fn((tag) => {
        if (tag === 'option') {
          return mockOption;
        }
        return originalCreateElement(tag);
      });

      // Act
      await controller.initialize();

      // Assert
      expect(global.document.createElement).toHaveBeenCalledWith('option');
      expect(mockOption.textContent).toBe(
        longConceptText.substring(0, 60) + '...'
      );

      // Restore original createElement
      global.document.createElement = originalCreateElement;
    });
  });

  describe('Concept Selection', () => {
    test('should load selected concept and populate textarea', async () => {
      // Arrange
      const conceptText = 'A brave knight';
      const mockConcept = createCharacterConcept(conceptText);
      mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        mockConcept
      );

      await controller.initialize();

      // Simulate concept selection using unified event system
      mockElements.previousConceptsSelect.value = mockConcept.id;
      const changeEvent = createMockEvent('change', {
        target: { value: mockConcept.id },
      });
      mockElements.previousConceptsSelect.dispatchEvent(changeEvent);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(
        mockCharacterBuilderService.getCharacterConcept
      ).toHaveBeenCalledWith(mockConcept.id);
      expect(mockElements.textarea.value).toBe(conceptText);
    });
  });
});
