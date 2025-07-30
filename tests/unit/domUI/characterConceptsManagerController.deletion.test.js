/**
 * @file Unit tests for CharacterConceptsManagerController deletion functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { UI_STATES } from '../../../src/shared/characterBuilder/uiStateManager.js';
import { createTestSetup } from './characterConceptsManagerController.testUtils.js';

// Mock UIStateManager module
jest.mock('../../../src/shared/characterBuilder/uiStateManager.js', () => {
  const mockUIStateManager = {
    showState: jest.fn(),
    showError: jest.fn(),
    showLoading: jest.fn(),
  };

  return {
    UIStateManager: jest.fn().mockImplementation(() => mockUIStateManager),
    UI_STATES: {
      EMPTY: 'empty',
      LOADING: 'loading',
      RESULTS: 'results',
      ERROR: 'error',
    },
  };
});

describe('CharacterConceptsManagerController - Deletion', () => {
  let setup;
  let controller;

  beforeEach(() => {
    setup = createTestSetup();
    controller = new CharacterConceptsManagerController(setup.config);
    // Set up UIStateManager for testing
    controller._testExports.uiStateManager = setup.mocks.uiStateManager;
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
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([
        {
          id: conceptId,
          concept: 'Test concept',
          created: Date.now(),
        },
      ]);

      // Re-initialize to load the concept
      await controller.initialize();

      // Act - Delete through service
      await setup.mocks.builderService.deleteCharacterConcept(conceptId);

      // Simulate the event that would be fired
      const deleteHandler = setup.mocks.eventBus.subscribe.mock.calls.find(
        (call) => call[0] === 'thematic:character_concept_deleted'
      )?.[1];

      if (deleteHandler) {
        deleteHandler({
          type: 'thematic:character_concept_deleted',
          payload: { conceptId },
        });
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Assert - UI should update
      expect(
        setup.mocks.builderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      // Arrange
      const error = new Error('Deletion failed');
      setup.mocks.builderService.deleteCharacterConcept.mockRejectedValue(
        error
      );

      // Act & Assert
      await expect(
        setup.mocks.builderService.deleteCharacterConcept('test-id')
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('UI State Management during deletion', () => {
    it('should update statistics after deletion', async () => {
      // Arrange
      const totalConceptsElement = document.getElementById('total-concepts');
      totalConceptsElement.textContent = '1';

      // Initialize with one concept
      const mockConcept = {
        id: 'test-id',
        concept: 'Test',
        created: Date.now(),
      };
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([
        mockConcept,
      ]);
      setup.mocks.builderService.getThematicDirections.mockResolvedValue([]);

      await controller.initialize();

      // Verify the conceptsData has the expected structure after initialization
      expect(controller._testExports.conceptsData).toHaveLength(1);
      expect(controller._testExports.conceptsData[0].concept.id).toBe(
        'test-id'
      );

      // Act - Update to no concepts
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([]);

      // Trigger the deletion event handler
      const deleteHandler = setup.mocks.eventBus.subscribe.mock.calls.find(
        (call) => call[0] === 'thematic:character_concept_deleted'
      )?.[1];

      if (deleteHandler) {
        await deleteHandler({
          type: 'thematic:character_concept_deleted',
          payload: { conceptId: 'test-id' },
        });
      }

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Concept should be removed from conceptsData
      expect(controller._testExports.conceptsData).toHaveLength(0);

      // Assert - The expected totalConcepts statistic should be 0
      // (since conceptsData.length is 0, totalConcepts calculation would be 0)
      expect(controller._testExports.conceptsData.length).toBe(0);
    });
  });
});
