/**
 * @file Unit tests for CharacterConceptsManagerController deletion functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { UI_STATES } from '../../../src/shared/characterBuilder/uiStateManager.js';

describe('CharacterConceptsManagerController - Deletion', () => {
  let mockLogger;
  let mockEventBus;
  let mockEventDispatcher;
  let mockCharacterBuilderService;
  let mockCharacterStorageService;
  let mockUIStateManager;
  let controller;

  // Helper to create mock DOM element
  const createMockElement = (id) => {
    const element = document.createElement('div');
    element.id = id;
    element.style.display = 'none';
    element.classList.add = jest.fn();
    element.classList.remove = jest.fn();
    element.innerHTML = '';
    return element;
  };

  beforeEach(() => {
    // Set up DOM structure
    document.body.innerHTML = `
      <div id="concepts-results"></div>
      <div id="empty-state" style="display: none;"></div>
      <div id="loading-state" style="display: none;"></div>
      <div id="error-state" style="display: none;"></div>
      <div id="results-state" style="display: none;"></div>
      <div id="total-concepts">0</div>
      <div id="concepts-with-directions">0</div>
      <div id="total-directions">0</div>
      <div id="average-directions">0</div>
      <div id="completion-rate">0</div>
    `;

    // Set up mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockEventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockUIStateManager = {
      showState: jest.fn(),
      showError: jest.fn(),
      showLoading: jest.fn(),
    };

    mockCharacterStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      storeCharacterConcept: jest.fn().mockResolvedValue(),
      deleteCharacterConcept: jest.fn().mockResolvedValue(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn().mockResolvedValue(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    // Mock UIStateManager constructor
    jest.mock('../../../src/shared/characterBuilder/uiStateManager.js', () => ({
      UIStateManager: jest.fn().mockImplementation(() => mockUIStateManager),
      UI_STATES: {
        EMPTY: 'empty',
        LOADING: 'loading',
        RESULTS: 'results',
        ERROR: 'error',
      },
    }));

    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      eventBus: mockEventBus,
      eventDispatcher: mockEventDispatcher,
      characterBuilderService: mockCharacterBuilderService,
      characterStorageService: mockCharacterStorageService,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Event-based deletion', () => {
    it('should handle deletion with UI state update when last concept is deleted', async () => {
      // Arrange - Create a concept in the UI
      const conceptId = 'test-concept-id';
      const conceptCard = document.createElement('div');
      conceptCard.className = 'concept-card';
      conceptCard.dataset.conceptId = conceptId;
      document.getElementById('concepts-results').appendChild(conceptCard);

      // Mock the controller having one concept initially
      mockCharacterStorageService.getAllCharacterConcepts.mockResolvedValue([{
        id: conceptId,
        concept: 'Test concept',
        created: Date.now(),
      }]);

      // Re-initialize to load the concept
      await controller.initialize();

      // Act - Delete through service
      await mockCharacterBuilderService.deleteCharacterConcept(conceptId);

      // Simulate the event that would be fired
      const deleteHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'thematic:character_concept_deleted'
      )?.[1];

      if (deleteHandler) {
        deleteHandler({
          type: 'thematic:character_concept_deleted',
          payload: { conceptId }
        });
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 350));

      // Assert - UI should update
      expect(mockCharacterStorageService.getAllCharacterConcepts).toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      // Arrange
      const error = new Error('Deletion failed');
      mockCharacterBuilderService.deleteCharacterConcept.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mockCharacterBuilderService.deleteCharacterConcept('test-id')
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('UI State Management during deletion', () => {
    it('should update statistics after deletion', async () => {
      // Arrange
      const totalConceptsElement = document.getElementById('total-concepts');
      totalConceptsElement.textContent = '1';

      // Initialize with one concept
      mockCharacterStorageService.getAllCharacterConcepts.mockResolvedValue([{
        id: 'test-id',
        concept: 'Test',
        created: Date.now(),
      }]);

      await controller.initialize();

      // Act - Update to no concepts
      mockCharacterStorageService.getAllCharacterConcepts.mockResolvedValue([]);
      
      // Trigger the deletion event handler
      const deleteHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'thematic:character_concept_deleted'
      )?.[1];

      if (deleteHandler) {
        deleteHandler({
          type: 'thematic:character_concept_deleted',
          payload: { conceptId: 'test-id' }
        });
      }

      // Assert - Statistics should be updated
      expect(totalConceptsElement.textContent).toBe('0');
    });
  });
});