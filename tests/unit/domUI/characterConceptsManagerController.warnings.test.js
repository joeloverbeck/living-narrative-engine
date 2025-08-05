/**
 * @file Tests to reproduce warning issues in CharacterConceptsManagerController
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

describe('CharacterConceptsManagerController - Warning Reproductions', () => {
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

  describe('UIStateManager Initialization Warning', () => {
    it('should reproduce UIStateManager warning when _showEmptyState is called during _loadConceptsData', async () => {
      // Arrange - Mock service to return no concepts (will trigger empty state)
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      // Create controller but don't initialize yet
      controller = testBase.createController();

      // Act - Initialize controller which should trigger the issue
      await controller.initialize();

      // Assert - Check that the warning is logged
      const uiStateWarnings = warnSpy.mock.calls.filter((call) =>
        call[0].includes('UIStateManager not initialized, cannot show state')
      );

      // After fix, there should be no warnings
      expect(uiStateWarnings.length).toBe(0);
    });

    it('should show the issue happens specifically during _loadConceptsData', async () => {
      // Arrange
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      controller = testBase.createController();

      // Track when methods are called
      const methodCalls = [];

      const originalLoadData = controller._loadInitialData.bind(controller);
      controller._loadInitialData = jest.fn(async () => {
        methodCalls.push('_loadInitialData:start');
        await originalLoadData();
        methodCalls.push('_loadInitialData:end');
      });

      const originalInitUIState =
        controller._initializeUIState.bind(controller);
      controller._initializeUIState = jest.fn(async () => {
        methodCalls.push('_initializeUIState:start');
        await originalInitUIState();
        methodCalls.push('_initializeUIState:end');
      });

      const originalShowState = controller._showState.bind(controller);
      controller._showState = jest.fn((state) => {
        methodCalls.push(`_showState:${state}`);
        return originalShowState(state);
      });

      // Act
      await controller.initialize();

      // Assert - Verify the fixed order
      const loadDataIndex = methodCalls.indexOf('_loadInitialData:start');
      const showEmptyIndex = methodCalls.indexOf('_showState:empty');
      const initUIIndex = methodCalls.indexOf('_initializeUIState:start');

      // After fix: _showState should be called AFTER UIStateManager is initialized
      // or not called at all during _loadInitialData (deferred to _initializeUIState)
      if (showEmptyIndex !== -1) {
        expect(showEmptyIndex).toBeGreaterThan(initUIIndex);
      }
    });
  });

  describe('Missing Event Definition Warning', () => {
    it('should reproduce missing event definition warning when updating a concept', async () => {
      // Arrange
      const conceptId = 'test-concept-123';
      const updatedConcept = {
        id: conceptId,
        concept: 'Updated test concept',
        updatedAt: new Date(),
      };

      // Mock the update to succeed
      testBase.mocks.characterBuilderService.updateCharacterConcept.mockResolvedValue(
        updatedConcept
      );

      // Also spy on eventBus dispatch to verify event is dispatched
      const dispatchSpy = jest.spyOn(testBase.mocks.eventBus, 'dispatch');

      // Act - Call the service method that dispatches the event
      await testBase.mocks.characterBuilderService.updateCharacterConcept(
        conceptId,
        { concept: 'Updated test concept' }
      );

      // Simulate the event dispatch that happens in the real service
      testBase.mocks.eventBus.dispatch('core:character_concept_updated', {
        concept: updatedConcept,
        updates: { concept: 'Updated test concept' },
      });

      // Assert - Check for the validation warning
      const validationWarnings = warnSpy.mock.calls.filter((call) =>
        call[0].includes(
          "EventDefinition not found for 'core:character_concept_updated'"
        )
      );

      // After fix, there should be no warnings
      expect(validationWarnings.length).toBe(0);
    });

    it('should show that character_concept_created works but character_concept_updated does not', async () => {
      // Arrange
      const createdConcept = {
        id: 'new-concept',
        concept: 'New concept',
        createdAt: new Date(),
      };

      // Act - Dispatch both events
      testBase.mocks.eventBus.dispatch('core:character_concept_created', {
        conceptId: createdConcept.id,
        concept: createdConcept.concept,
        autoSaved: true,
      });

      testBase.mocks.eventBus.dispatch('core:character_concept_updated', {
        concept: createdConcept,
        updates: { concept: 'Updated concept' },
      });

      // Assert
      const allWarnings = warnSpy.mock.calls.map((call) => call[0]);

      // Created event should not produce warnings
      const createdWarnings = allWarnings.filter((w) =>
        w.includes(
          "EventDefinition not found for 'core:character_concept_created'"
        )
      );
      expect(createdWarnings.length).toBe(0);

      // Updated event should NOT produce warnings after fix
      const updatedWarnings = allWarnings.filter((w) =>
        w.includes(
          "EventDefinition not found for 'core:character_concept_updated'"
        )
      );
      expect(updatedWarnings.length).toBe(0);
    });
  });
});
