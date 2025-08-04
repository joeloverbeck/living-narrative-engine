/**
 * @file Unit tests for CharacterConceptsManagerController - Missing Event Definitions
 *
 * These tests verify that the UI_STATE_CHANGED and CONTROLLER_INITIALIZED events
 * are being dispatched without proper schema definitions, which causes warnings
 * in production.
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

describe('CharacterConceptsManagerController - Missing Event Definitions', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;
  let dispatchedEvents;

  beforeEach(async () => {
    await testBase.setup();

    // Track all dispatched events
    dispatchedEvents = [];
    testBase.mocks.eventBus.dispatch.mockImplementation(
      (eventType, payload) => {
        dispatchedEvents.push({ eventName: eventType, payload });
      }
    );
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('UI_STATE_CHANGED Event Definition', () => {
    it('should dispatch UI_STATE_CHANGED event during initialization', async () => {
      // Arrange - Mock to ensure state change will occur
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Act - Create and initialize controller
      controller = testBase.createController();
      await controller.initialize();

      // Assert - Verify UI_STATE_CHANGED events were dispatched
      const uiStateEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:ui_state_changed'
      );
      expect(uiStateEvents.length).toBeGreaterThan(0);

      // Note: In production, these events cause VED warnings because they lack schema definitions
    });

    it('should dispatch UI_STATE_CHANGED with correct payload structure', async () => {
      // Arrange
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Act
      controller = testBase.createController();
      await controller.initialize();

      // Assert - Verify event structure
      const uiStateEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:ui_state_changed'
      );
      expect(uiStateEvents.length).toBeGreaterThan(0);

      const firstEvent = uiStateEvents[0];
      expect(firstEvent.payload).toMatchObject({
        controller: 'CharacterConceptsManagerController',
        previousState: undefined, // First state change has no previous state
        currentState: expect.any(String),
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        ),
      });
    });
  });

  describe('CONTROLLER_INITIALIZED Event Definition', () => {
    it('should dispatch CONTROLLER_INITIALIZED event during initialization', async () => {
      // Arrange
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Act
      controller = testBase.createController();
      await controller.initialize();

      // Assert - Verify CONTROLLER_INITIALIZED event was dispatched
      const initEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:controller_initialized'
      );
      expect(initEvents.length).toBe(1);

      // Note: In production, this event causes VED warnings because it lacks schema definition
    });

    it('should dispatch CONTROLLER_INITIALIZED with correct payload structure', async () => {
      // Arrange
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Act
      controller = testBase.createController();
      await controller.initialize();

      // Assert - Verify event structure
      const initEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:controller_initialized'
      );
      expect(initEvents.length).toBe(1);

      const event = initEvents[0];
      expect(event.payload).toMatchObject({
        controllerName: 'CharacterConceptsManagerController',
        initializationTime: expect.any(Number),
      });
      expect(event.payload.initializationTime).toBeGreaterThan(0);
    });
  });

  describe('Events Sequence During Initialization', () => {
    it('should dispatch both UI_STATE_CHANGED and CONTROLLER_INITIALIZED events', async () => {
      // Arrange - Set up to trigger both empty and results states
      testBase.mocks.characterBuilderService.getAllCharacterConcepts
        .mockResolvedValueOnce([]) // First call returns empty
        .mockResolvedValueOnce([
          // Second call returns concepts
          { id: '1', concept: 'Test', createdAt: new Date() },
        ]);

      testBase.mocks.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      // Act
      controller = testBase.createController();
      await controller.initialize();

      // Trigger a reload to get results state
      await controller._loadConceptsData();

      // Assert - Verify multiple events were dispatched
      const uiStateEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:ui_state_changed'
      );
      const controllerInitEvents = dispatchedEvents.filter(
        (e) => e.eventName === 'core:controller_initialized'
      );

      expect(uiStateEvents.length).toBeGreaterThan(1); // Multiple state changes
      expect(controllerInitEvents.length).toBe(1); // One initialization

      // Note: In production, all these events cause VED warnings because they lack schema definitions
    });
  });
});
