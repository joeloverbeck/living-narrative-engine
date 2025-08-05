/**
 * @file Unit tests for CharacterConceptsManagerController UI state transitions
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
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController - UI State Transitions', () => {
  const testBase = new CharacterConceptsManagerTestBase();

  beforeEach(async () => {
    await testBase.setup();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Loading states', () => {
    it('should use _executeWithErrorHandling for loading with retry logic', async () => {
      // Arrange - Set up response
      testBase.configureConcepts([]);

      const controller = testBase.createController();
      testBase.populateControllerElements(controller);
      controller._cacheElements();

      // Spy on base class state management methods
      jest.spyOn(controller, '_showState');
      jest.spyOn(controller, '_executeWithErrorHandling');

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
      testBase.configureConcepts(mockConcepts);

      const controller = testBase.createController();
      testBase.populateControllerElements(controller);
      controller._cacheElements();

      // Spy on base class methods
      jest.spyOn(controller, '_showState');

      // Act - Initialize the controller fully to trigger proper state management
      await controller.initialize();

      // Assert - Should call base class _showState with 'results' after UIStateManager is ready
      expect(controller._showState).toHaveBeenCalledWith('results');
    });

  });
});
