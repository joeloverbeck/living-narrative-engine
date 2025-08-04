/**
 * @file Unit tests for CharacterConceptsManagerController - Initialization Order Issues
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController - Initialization Order Issues', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;
  let warnSpy;

  beforeEach(async () => {
    await testBase.setup();
    // Spy on logger.warn to capture warnings
    warnSpy = jest.spyOn(testBase.mocks.logger, 'warn');
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('UIStateManager Initialization Order - Fixed', () => {
    it('should NOT warn when _showState is called during data loading', async () => {
      // Arrange - Mock service to return concepts data
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        [
          { id: 'concept-1', concept: 'Test concept 1', createdAt: new Date() },
          { id: 'concept-2', concept: 'Test concept 2', createdAt: new Date() },
        ]
      );

      testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      // Create controller but don't initialize yet
      controller = testBase.createController();

      // Act - Initialize controller which previously triggered the issue
      await controller.initialize();

      // Assert - Check that the warning is no longer logged
      const uiStateWarnings = warnSpy.mock.calls.filter((call) =>
        call[0].includes('UIStateManager not initialized, cannot show state')
      );
      expect(uiStateWarnings.length).toBe(0);
    });

    it('should defer showing results state until UIStateManager is ready', async () => {
      // Arrange - Mock to have concepts that will trigger _displayConcepts
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        [{ id: 'test-1', concept: 'Sample concept', createdAt: new Date() }]
      );

      testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      // Create controller
      controller = testBase.createController();

      // Spy on _showState to track when it's called
      const showStateSpy = jest.spyOn(controller, '_showState');

      // Act - Initialize which follows the exact flow from logs
      await controller.initialize();

      // Assert - Verify that _showState('results') is called after UIStateManager is ready
      const resultsStateCalls = showStateSpy.mock.calls.filter(
        (call) => call[0] === 'results'
      );
      expect(resultsStateCalls.length).toBeGreaterThan(0);

      // No warnings about UIStateManager
      const uiStateWarnings = warnSpy.mock.calls.filter((call) =>
        call[0].includes('UIStateManager not initialized, cannot show state')
      );
      expect(uiStateWarnings.length).toBe(0);
    });

    it('should not warn if no concepts exist (empty state)', async () => {
      // Arrange - No concepts
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Create and initialize controller
      controller = testBase.createController();
      await controller.initialize();

      // Assert - No warning about UIStateManager for 'results' state
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "UIStateManager not initialized, cannot show state 'results'"
        )
      );
    });
  });

  describe('Initialization Lifecycle Flow - Fixed', () => {
    it('should demonstrate the fixed initialization order', async () => {
      // Arrange
      const lifecycleOrder = [];

      // Mock to track when each lifecycle method is called
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockImplementation(
        async () => {
          lifecycleOrder.push('_loadInitialData->getAllCharacterConcepts');
          return [{ id: '1', concept: 'Test', createdAt: new Date() }];
        }
      );

      testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      // Create controller
      controller = testBase.createController();

      // Track when _displayConcepts stores pending state
      const originalDisplayConcepts =
        controller._displayConcepts.bind(controller);
      controller._displayConcepts = jest.fn((concepts) => {
        lifecycleOrder.push('_displayConcepts');
        return originalDisplayConcepts(concepts);
      });

      // Track when _initializeUIState applies pending state
      const originalInitUIState =
        controller._initializeUIState.bind(controller);
      controller._initializeUIState = jest.fn(async () => {
        lifecycleOrder.push('_initializeUIState');
        return originalInitUIState();
      });

      // Track when _showState is called with results
      const originalShowState = controller._showState.bind(controller);
      controller._showState = jest.fn((state, options) => {
        if (state === 'results') {
          lifecycleOrder.push(`_showState('results')`);
        }
        return originalShowState(state, options);
      });

      // Act
      await controller.initialize();

      // Assert - Verify fixed order
      const displayConceptsIndex = lifecycleOrder.indexOf('_displayConcepts');
      const initUIStateIndex = lifecycleOrder.indexOf('_initializeUIState');
      const showResultsIndex = lifecycleOrder.indexOf("_showState('results')");

      // _displayConcepts is called during _loadInitialData
      expect(displayConceptsIndex).toBeGreaterThanOrEqual(0);

      // _initializeUIState comes after _loadInitialData
      expect(initUIStateIndex).toBeGreaterThan(displayConceptsIndex);

      // _showState('results') is called after UIStateManager is ready
      expect(showResultsIndex).toBeGreaterThan(initUIStateIndex);
    });
  });
});
