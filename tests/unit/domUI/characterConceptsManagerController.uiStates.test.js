/**
 * @file Unit tests for CharacterConceptsManagerController UI state transitions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  createTestSetup,
  populateControllerElements,
} from './characterConceptsManagerController.testUtils.js';

describe('CharacterConceptsManagerController - UI State Transitions', () => {
  let setup;
  let controller;

  beforeEach(() => {
    // Clear mock calls between tests
    jest.clearAllMocks();

    setup = createTestSetup();
    controller = new CharacterConceptsManagerController(setup.config);

    // Populate controller's internal elements cache for testing
    populateControllerElements(controller, setup.elements);

    // Call _cacheElements to properly initialize the controller's element cache
    controller._cacheElements();

    // Spy on base class state management methods
    jest.spyOn(controller, '_showState');
    jest.spyOn(controller, '_showError');
    jest.spyOn(controller, '_showLoading');
    jest.spyOn(controller, '_executeWithErrorHandling');
  });

  describe('Loading states', () => {
    it('should use _executeWithErrorHandling for loading with retry logic', async () => {
      // Arrange - Set up response
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([]);

      // Act - Call loadData directly
      await controller._testExports.loadData();

      // Assert - Should use _executeWithErrorHandling with proper configuration
      expect(controller._executeWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        'load character concepts',
        expect.objectContaining({
          retries: 2,
          userErrorMessage:
            'Failed to load character concepts. Please try again.',
          loadingMessage: 'Loading character concepts...',
        })
      );
    });

    it('should show results state when concepts exist', async () => {
      // Arrange
      const mockConcepts = [
        { id: '1', concept: 'Concept 1', created: Date.now() },
        { id: '2', concept: 'Concept 2', created: Date.now() },
      ];
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Act - Call loadData directly
      await controller._testExports.loadData();

      // Assert - Should call base class _showState with 'results'
      expect(controller._showState).toHaveBeenCalledWith('results');
    });

    it('should show empty state when no concepts exist', async () => {
      // Arrange
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([]);

      // Act - Call loadData directly
      await controller._testExports.loadData();

      // Assert - Should call base class _showState with 'empty'
      expect(controller._showState).toHaveBeenCalledWith('empty');
    });
  });

  describe('Error states', () => {
    it('should handle load failure with retry logic', async () => {
      // Arrange
      const error = new Error('Failed to load concepts');
      setup.mocks.builderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      // Act & Assert - Should throw error after retries are exhausted
      await expect(controller._testExports.loadData()).rejects.toThrow();

      // Should have used _executeWithErrorHandling with retry configuration
      expect(controller._executeWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        'load character concepts',
        expect.objectContaining({
          retries: 2,
          userErrorMessage:
            'Failed to load character concepts. Please try again.',
        })
      );
    });

    it('should handle concept creation failure with retry logic', async () => {
      // Arrange
      const error = new Error('Creation failed');
      setup.mocks.builderService.createCharacterConcept.mockRejectedValue(
        error
      );

      // Set up form data - Use a valid concept (50-3000 chars)
      const validConcept = 'A'.repeat(100); // 100 characters to meet minimum requirement
      // Set the value on the actual element in the DOM
      setup.elements['concept-text'].value = validConcept;

      // Act - Use handleConceptSave which includes error handling
      await controller._testExports.handleConceptSave();

      // Assert - Should use _executeWithErrorHandling with retry logic for create operation
      expect(controller._executeWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        'create character concept',
        expect.objectContaining({
          retries: 1,
          userErrorMessage: 'Failed to create concept. Please try again.',
          loadingMessage: 'Creating concept...',
        })
      );
    });
  });

  describe('State transitions during operations', () => {
    it('should transition from results to empty after deleting last concept', async () => {
      // Arrange - Use the correct data structure that matches production
      const mockConceptData = {
        concept: {
          id: 'test-id',
          text: 'Test concept',
          created: Date.now(),
        },
        directionCount: 0,
      };
      controller._testExports.conceptsData = [mockConceptData];
      setup.mocks.builderService.deleteCharacterConcept.mockResolvedValue();

      // Mock the card element that will be deleted
      const mockCard = document.createElement('div');
      mockCard.setAttribute('data-concept-id', 'test-id');
      mockCard.classList.add('concept-card');
      setup.elements['concepts-results'].appendChild(mockCard);

      // Act
      await controller._testExports.deleteConcept('test-id', 0);

      // Assert - Should call _showState with 'empty' when last concept is deleted
      expect(controller._showState).toHaveBeenCalledWith('empty');

      // Should also use _executeWithErrorHandling for delete operation
      expect(controller._executeWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        'delete character concept',
        expect.objectContaining({
          retries: 1,
          userErrorMessage: 'Failed to delete concept. Please try again.',
          loadingMessage: 'Deleting concept...',
        })
      );
    });

    it('should maintain results state after deleting one of many concepts', async () => {
      // Arrange - Use the correct data structure that matches production
      const concepts = [
        {
          concept: { id: '1', text: 'Concept 1', created: Date.now() },
          directionCount: 0,
        },
        {
          concept: { id: '2', text: 'Concept 2', created: Date.now() },
          directionCount: 0,
        },
        {
          concept: { id: '3', text: 'Concept 3', created: Date.now() },
          directionCount: 0,
        },
      ];
      controller._testExports.conceptsData = concepts;
      setup.mocks.builderService.deleteCharacterConcept.mockResolvedValue();

      // Mock the card element that will be deleted
      const mockCard = document.createElement('div');
      mockCard.setAttribute('data-concept-id', '1');
      mockCard.classList.add('concept-card');
      setup.elements['concepts-results'].appendChild(mockCard);

      // Reset spy to track only calls during delete
      controller._showState.mockClear();

      // Act
      await controller._testExports.deleteConcept('1', 0);

      // Assert - Should not call _showState('empty') since concepts remain
      // but should still use _executeWithErrorHandling for the delete operation
      expect(controller._showState).not.toHaveBeenCalledWith('empty');
      expect(controller._executeWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        'delete character concept',
        expect.objectContaining({
          retries: 1,
          userErrorMessage: 'Failed to delete concept. Please try again.',
        })
      );
    });

    it('should use base class state management methods consistently', async () => {
      // Arrange - Set up successful operations
      setup.mocks.builderService.getAllCharacterConcepts.mockResolvedValue([
        { id: '1', concept: 'Test concept', created: Date.now() },
      ]);

      // Act - Load data and verify method usage
      await controller._testExports.loadData();

      // Assert - All state management should go through base class methods
      expect(controller._executeWithErrorHandling).toHaveBeenCalled();
      expect(controller._showState).toHaveBeenCalledWith('results');
    });
  });
});
