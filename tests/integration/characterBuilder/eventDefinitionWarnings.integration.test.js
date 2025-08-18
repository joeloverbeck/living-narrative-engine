/**
 * @file Integration test to reproduce and verify event definition warnings
 * Tests that all CHARACTER_BUILDER_EVENTS have proper event definition files
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Character Builder Event Definition Warnings', () => {
  let testBed;
  let mockLogger;
  let eventBus;
  let gameDataRepository;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get services
    eventBus = testBed.get('ISafeEventDispatcher');
    gameDataRepository = testBed.get('IGameDataRepository');
    mockLogger = testBed.get('ILogger');

    // Reset logger call tracking
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('Event Definition Validation', () => {
    it('should not generate warnings when dispatching core:thematic_directions_generated event', async () => {
      // Arrange
      const payload = {
        conceptId: 'test-concept-id',
        directionCount: 5,
        autoSaved: true,
      };

      // Act - dispatch the event
      await eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
        payload
      );

      // Assert - no warnings should be generated
      const warnCalls = mockLogger.warn.mock.calls;
      const eventWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('thematic_directions_generated') &&
          call[0]?.includes('EventDefinition not found')
      );

      expect(eventWarnings).toHaveLength(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not generate warnings when dispatching core:character_concept_saved event', async () => {
      // Arrange
      const payload = {
        conceptId: 'test-concept-id',
        concept: 'Test character concept',
      };

      // Act
      await eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CONCEPT_SAVED, payload);

      // Assert
      const warnCalls = mockLogger.warn.mock.calls;
      const eventWarnings = warnCalls.filter(
        (call) =>
          call[0]?.includes('character_concept_saved') &&
          call[0]?.includes('EventDefinition not found')
      );

      expect(eventWarnings).toHaveLength(0);
    });

    it('should not generate warnings when dispatching cliches-related events', async () => {
      const clicheEvents = [
        {
          event: CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED,
          payload: {
            conceptId: 'test-id',
            directionId: 'direction-id',
            cliches: [],
          },
        },
        {
          event: CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVAL_FAILED,
          payload: {
            conceptId: 'test-id',
            directionId: 'direction-id',
            error: 'Test error',
          },
        },
        {
          event: CHARACTER_BUILDER_EVENTS.CLICHES_STORED,
          payload: {
            conceptId: 'test-id',
            directionId: 'direction-id',
            clicheId: 'cliche-id',
          },
        },
        {
          event: CHARACTER_BUILDER_EVENTS.CLICHES_STORAGE_FAILED,
          payload: {
            conceptId: 'test-id',
            directionId: 'direction-id',
            error: 'Storage error',
          },
        },
        {
          event: CHARACTER_BUILDER_EVENTS.CLICHES_DELETED,
          payload: { conceptId: 'test-id', directionId: 'direction-id' },
        },
      ];

      for (const { event, payload } of clicheEvents) {
        mockLogger.warn.mockClear();

        // Act
        await eventBus.dispatch(event, payload);

        // Assert
        const warnCalls = mockLogger.warn.mock.calls;
        const eventWarnings = warnCalls.filter(
          (call) =>
            call[0]?.includes(event) &&
            call[0]?.includes('EventDefinition not found')
        );

        expect(eventWarnings).toHaveLength(0);
      }
    });
  });

  describe('Event Definition Loading', () => {
    it('should find all CHARACTER_BUILDER_EVENTS in GameDataRepository', () => {
      const events = Object.values(CHARACTER_BUILDER_EVENTS);

      for (const eventName of events) {
        const eventDefinition =
          gameDataRepository.getEventDefinition(eventName);

        // This will fail for missing event definitions
        if (!eventDefinition) {
          console.log(`Missing event definition: ${eventName}`);
        }
        expect(eventDefinition).toBeDefined();
        expect(eventDefinition?.id).toBe(eventName);
        expect(eventDefinition?.payloadSchema).toBeDefined();
      }
    });
  });

  describe('Payload Validation', () => {
    it('should validate payloads correctly for core:thematic_directions_generated', async () => {
      // Valid payload
      const validPayload = {
        conceptId: 'test-concept-123',
        directionCount: 5,
        autoSaved: true,
      };

      await expect(
        eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
          validPayload
        )
      ).resolves.toBe(true);

      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/Payload validation FAILED/)
      );
    });

    it('should reject invalid payloads for core:thematic_directions_generated', async () => {
      // Invalid payload (missing required fields)
      const invalidPayload = {
        conceptId: 'test-concept-123',
        // missing directionCount and autoSaved
      };

      await expect(
        eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
          invalidPayload
        )
      ).resolves.toBe(false);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Payload validation FAILED for event 'core:thematic_directions_generated'/
        ),
        expect.any(Object)
      );
    });
  });
});
