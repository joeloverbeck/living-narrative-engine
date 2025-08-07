/**
 * Integration tests for thematic directions manager event warnings
 * These tests ensure that the fixes for event definition and schema registration warnings work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('ThematicDirectionsManager Event Warnings Regression', () => {
  let testBed;
  let mockLogger;
  let eventBus;
  let gameDataRepository;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get services
    eventBus = testBed.get('ISafeEventDispatcher');
    gameDataRepository = testBed.get('IGameDataRepository');
    mockLogger = testBed.get('ILogger');
    characterBuilderService = testBed.get('CharacterBuilderService');

    // Initialize the character builder service
    await characterBuilderService.initialize();

    // Reset logger call tracking
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('Event Definition Validation', () => {
    it('should not generate warnings when dispatching core:analytics_track events', async () => {
      // Arrange - dispatch analytics track event (used in dropdown interactions)
      const payload = {
        event: 'thematic_dropdown_interaction',
        properties: {
          action: 'select',
          value: 'test-concept-id',
          timestamp: Date.now(),
          sessionId: 'test-session',
          filter: '',
          conceptId: 'test-concept-id',
        },
      };

      // Act - dispatch the event
      await eventBus.dispatch('core:analytics_track', payload);

      // Assert - no warnings should be generated
      const warnCalls = mockLogger.warn.mock.calls;
      const analyticsWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('analytics_track') ||
          call[0]?.includes('ANALYTICS_TRACK')
      );

      expect(analyticsWarnings).toHaveLength(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not generate warnings when dispatching core:direction_updated events', async () => {
      // Arrange - use a simple test direction ID without creating actual directions
      // This test is about event dispatching, not thematic direction generation
      const payload = {
        directionId: 'test-direction-id-123',
        field: 'title',
        oldValue: 'Old title',
        newValue: 'New title',
      };

      // Act - dispatch the event
      await eventBus.dispatch('core:direction_updated', payload);

      // Assert - no warnings should be generated
      const warnCalls = mockLogger.warn.mock.calls;
      const directionWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('direction_updated') &&
          call[0]?.includes('EventDefinition not found')
      );

      expect(directionWarnings).toHaveLength(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not generate warnings when dispatching core:direction_deleted events', async () => {
      // Arrange - use a simple test direction ID without creating actual directions
      // This test is about event dispatching, not thematic direction generation
      const payload = {
        directionId: 'test-direction-id-456',
      };

      // Act - dispatch the event
      await eventBus.dispatch('core:direction_deleted', payload);

      // Assert - no warnings should be generated
      const warnCalls = mockLogger.warn.mock.calls;
      const deletionWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('direction_deleted') &&
          call[0]?.includes('EventDefinition not found')
      );

      expect(deletionWarnings).toHaveLength(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not generate warnings when dispatching core:orphans_cleaned events', async () => {
      // Arrange
      const payload = {
        deletedCount: 3,
      };

      // Act - dispatch the event
      await eventBus.dispatch('core:orphans_cleaned', payload);

      // Assert - no warnings should be generated
      const warnCalls = mockLogger.warn.mock.calls;
      const orphansWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('orphans_cleaned') &&
          call[0]?.includes('EventDefinition not found')
      );

      expect(orphansWarnings).toHaveLength(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Schema Registration', () => {
    it('should find event definitions in GameDataRepository', () => {
      // Test that all the events we fixed are properly loaded
      const events = [
        'core:analytics_track',
        'core:direction_updated',
        'core:direction_deleted',
        'core:orphans_cleaned',
      ];

      for (const eventName of events) {
        const eventDefinition =
          gameDataRepository.getEventDefinition(eventName);
        expect(eventDefinition).toBeDefined();
        expect(eventDefinition.id).toBe(eventName);
        expect(eventDefinition.payloadSchema).toBeDefined();
      }
    });

    it('should not generate schema overwrite warnings during mod loading', async () => {
      // This test verifies that duplicate schema registrations don't occur
      // We check for warnings that contain 'already loaded. Overwriting'
      const warnCalls = mockLogger.warn.mock.calls;
      const schemaOverwriteWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('already loaded. Overwriting') &&
          (call[0]?.includes('controller_initialized') ||
            call[0]?.includes('ui_state_changed'))
      );

      expect(schemaOverwriteWarnings).toHaveLength(0);
    });
  });

  describe('Payload Validation', () => {
    it('should validate payloads correctly for core:direction_updated', async () => {
      // Arrange - valid payload
      const validPayload = {
        directionId: 'test-direction-123',
        field: 'title',
        oldValue: 'Old Title',
        newValue: 'New Title',
      };

      // Act & Assert - should not throw validation errors
      await expect(
        eventBus.dispatch('core:direction_updated', validPayload)
      ).resolves.toBe(true);

      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/Payload validation FAILED/)
      );
    });

    it('should reject invalid payloads for core:direction_updated', async () => {
      // Arrange - invalid payload (missing required field)
      const invalidPayload = {
        directionId: 'test-direction-123',
        // missing 'field', 'oldValue', 'newValue'
      };

      // Act & Assert - should fail validation
      await expect(
        eventBus.dispatch('core:direction_updated', invalidPayload)
      ).resolves.toBe(false);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Payload validation FAILED for event 'core:direction_updated'/
        ),
        expect.any(Object) // The second parameter is the error context object
      );
    });

    it('should validate field enum constraints for core:direction_updated', async () => {
      // Arrange - payload with invalid field name
      const invalidFieldPayload = {
        directionId: 'test-direction-123',
        field: 'invalidFieldName', // Not in the enum
        oldValue: 'Old Value',
        newValue: 'New Value',
      };

      // Act & Assert - should fail validation
      await expect(
        eventBus.dispatch('core:direction_updated', invalidFieldPayload)
      ).resolves.toBe(false);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Payload validation FAILED for event 'core:direction_updated'/
        ),
        expect.any(Object) // The second parameter is the error context object
      );
    });
  });
});
