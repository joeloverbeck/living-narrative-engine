/**
 * @file Unit tests for CharacterConceptsManagerController UI state transitions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { createTestSetup } from './characterConceptsManagerController.testUtils.js';
import { UI_STATES } from '../../../src/shared/characterBuilder/uiStateManager.js';

describe('CharacterConceptsManagerController - UI State Transitions', () => {
  let setup;
  let controller;

  beforeEach(() => {
    setup = createTestSetup();
    controller = new CharacterConceptsManagerController(setup.config);
  });

  describe('Loading states', () => {
    it('should show loading state during data fetch', async () => {
      // Arrange
      setup.mocks.storageService.getAllCharacterConcepts.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 50);
          })
      );

      // Act
      const loadPromise = controller.loadData();

      // Assert - Check loading state is shown immediately
      expect(setup.mocks.uiStateManager.showState).toHaveBeenCalledWith(
        UI_STATES.LOADING
      );

      await loadPromise;

      // Should transition to appropriate state after loading
      expect(setup.mocks.uiStateManager.showState).toHaveBeenCalledWith(
        UI_STATES.EMPTY
      );
    });

    it('should show results state when concepts exist', async () => {
      // Arrange
      const mockConcepts = [
        { id: '1', concept: 'Concept 1', created: Date.now() },
        { id: '2', concept: 'Concept 2', created: Date.now() },
      ];
      setup.mocks.storageService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Act
      await controller.loadData();

      // Assert
      expect(setup.mocks.uiStateManager.showState).toHaveBeenCalledWith(
        UI_STATES.RESULTS
      );
    });

    it('should show empty state when no concepts exist', async () => {
      // Arrange
      setup.mocks.storageService.getAllCharacterConcepts.mockResolvedValue([]);

      // Act
      await controller.loadData();

      // Assert
      expect(setup.mocks.uiStateManager.showState).toHaveBeenCalledWith(
        UI_STATES.EMPTY
      );
    });
  });

  describe('Error states', () => {
    it('should show error state on load failure', async () => {
      // Arrange
      const error = new Error('Failed to load concepts');
      setup.mocks.storageService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      // Act
      await controller.loadData();

      // Assert
      expect(setup.mocks.uiStateManager.showError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load')
      );
    });

    it('should show error message on concept creation failure', async () => {
      // Arrange
      const error = new Error('Creation failed');
      setup.mocks.builderService.createCharacterConcept.mockRejectedValue(
        error
      );

      // Act
      try {
        await controller.createConcept('Test concept');
      } catch (e) {
        // Expected
      }

      // Assert
      expect(setup.mocks.uiStateManager.showError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create')
      );
    });
  });

  describe('State transitions during operations', () => {
    it('should transition from results to empty after deleting last concept', async () => {
      // Arrange
      const mockConcept = {
        id: 'test-id',
        concept: 'Test concept',
        created: Date.now(),
      };
      controller.conceptsData = [mockConcept];
      setup.mocks.builderService.deleteCharacterConcept.mockResolvedValue();

      // Act
      await controller.deleteConcept('test-id');

      // Assert
      const calls = setup.mocks.uiStateManager.showState.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(UI_STATES.EMPTY);
    });

    it('should maintain results state after deleting one of many concepts', async () => {
      // Arrange
      const concepts = [
        { id: '1', concept: 'Concept 1', created: Date.now() },
        { id: '2', concept: 'Concept 2', created: Date.now() },
        { id: '3', concept: 'Concept 3', created: Date.now() },
      ];
      controller.conceptsData = concepts;
      setup.mocks.builderService.deleteCharacterConcept.mockResolvedValue();

      // Reset mock to track only calls during delete
      setup.mocks.uiStateManager.showState.mockClear();

      // Act
      await controller.deleteConcept('1');

      // Assert - Should not call showState at all since we're staying in results
      expect(setup.mocks.uiStateManager.showState).not.toHaveBeenCalled();
    });

    it('should handle rapid state changes correctly', async () => {
      // Arrange
      const delays = [10, 20, 30];
      const promises = delays.map(
        (delay) =>
          new Promise((resolve) => {
            setTimeout(() => {
              controller.conceptsData = [];
              controller.updateStatistics();
              resolve();
            }, delay);
          })
      );

      // Act
      await Promise.all(promises);

      // Assert - Should handle all state changes without errors
      expect(setup.mocks.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Modal state management', () => {
    it('should maintain UI state when opening modals', () => {
      // Arrange
      controller.conceptsData = [
        { id: '1', concept: 'Test', created: Date.now() },
      ];

      // Act
      controller.showCreateModal();

      // Assert - UI state should not change when showing modal
      expect(setup.mocks.uiStateManager.showState).not.toHaveBeenCalled();
    });

    it('should restore appropriate state after modal operations', async () => {
      // Arrange
      controller.conceptsData = [];
      setup.mocks.builderService.createCharacterConcept.mockResolvedValue({
        conceptId: 'new-id',
        concept: 'New concept',
      });

      // Act - Create concept which should transition from empty to results
      await controller.createConcept('New concept');

      // Assert
      expect(setup.mocks.uiStateManager.showState).toHaveBeenCalledWith(
        UI_STATES.RESULTS
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle missing UI state manager gracefully', () => {
      // Arrange
      controller.uiStateManager = null;

      // Act & Assert - Should not throw
      expect(() => {
        controller.updateStatistics();
      }).not.toThrow();
    });

    it('should handle concurrent state transitions', async () => {
      // Arrange
      const loadPromise1 = controller.loadData();
      const loadPromise2 = controller.loadData();

      // Act
      await Promise.all([loadPromise1, loadPromise2]);

      // Assert - Should complete without errors
      expect(setup.mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should handle state transitions during component teardown', () => {
      // Arrange
      controller.conceptsData = [{ id: '1', concept: 'Test' }];

      // Act - Simulate rapid deletion and state change
      controller.removeConceptCard('1');
      controller.conceptsData = [];
      
      // Immediately try to update state
      controller.updateStatistics();

      // Assert - Should not throw errors
      expect(setup.mocks.logger.error).not.toHaveBeenCalled();
    });
  });
});