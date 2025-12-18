/**
 * @jest-environment node
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('Perceptible Event Actor Exclusion - Integration Tests', () => {
  let logger;
  let dispatcher;
  let dispatchHandler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();

    // Current architecture: DispatchPerceptibleEventHandler only dispatches events.
    // Log entry creation is handled by log_perceptible_events.rule.json which
    // triggers ADD_PERCEPTION_LOG_ENTRY operation in response to core:perceptible_event.
    dispatchHandler = new DispatchPerceptibleEventHandler({
      dispatcher,
      logger,
    });

    jest.clearAllMocks();
  });

  test('end-to-end: actor examines item briefly, excluded from broadcast - event dispatched with exclusion data', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actorId = 'npc:alice';

    const params = {
      location_id: locationId,
      description_text: 'Alice briefly examines the ancient tome.',
      perception_type: 'item.examine',
      actor_id: actorId,
      contextual_data: {
        excludedActorIds: [actorId], // Alice doesn't see her own brief examination
      },
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - Event dispatched with exclusion data in contextualData
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        actorId,
        locationId,
        descriptionText: 'Alice briefly examines the ancient tome.',
        perceptionType: 'item.examine',
        contextualData: expect.objectContaining({
          recipientIds: [],
          excludedActorIds: [actorId],
        }),
      })
    );
  });

  test('multiple perceptible events with different exclusions - each event dispatched correctly', async () => {
    // Arrange
    const locationId = 'loc:tavern';

    // Act - Event 1: Alice speaks (exclude Alice)
    await dispatchHandler.execute(
      {
        location_id: locationId,
        description_text: 'Alice says hello.',
        perception_type: 'communication.speech',
        actor_id: 'npc:alice',
        contextual_data: { excludedActorIds: ['npc:alice'] },
      },
      {}
    );

    // Act - Event 2: Bob examines (exclude Bob)
    await dispatchHandler.execute(
      {
        location_id: locationId,
        description_text: 'Bob examines the map.',
        perception_type: 'item.examine',
        actor_id: 'npc:bob',
        contextual_data: { excludedActorIds: ['npc:bob'] },
      },
      {}
    );

    // Assert - Both events dispatched with correct exclusions
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);

    // Event 1: Alice excluded
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      'core:perceptible_event',
      expect.objectContaining({
        actorId: 'npc:alice',
        contextualData: expect.objectContaining({
          excludedActorIds: ['npc:alice'],
        }),
      })
    );

    // Event 2: Bob excluded
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      'core:perceptible_event',
      expect.objectContaining({
        actorId: 'npc:bob',
        contextualData: expect.objectContaining({
          excludedActorIds: ['npc:bob'],
        }),
      })
    );
  });

  test('backward compatibility: events without excludedActorIds work as before', async () => {
    // Arrange
    const locationId = 'loc:tavern';

    const params = {
      location_id: locationId,
      description_text: 'A mysterious sound echoes.',
      perception_type: 'state.observable_change',
      actor_id: 'npc:environment',
      // No contextual_data at all (backward compatible)
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - Event dispatched with default empty arrays
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        contextualData: expect.objectContaining({
          recipientIds: [],
          excludedActorIds: [],
        }),
      })
    );
  });

  test('mutual exclusivity: error when both recipientIds and excludedActorIds provided', async () => {
    // Arrange
    const params = {
      location_id: 'loc:tavern',
      description_text: 'Test event.',
      perception_type: 'physical.target_action',
      actor_id: 'npc:alice',
      contextual_data: {
        recipientIds: ['npc:bob'],
        excludedActorIds: ['npc:charlie'],
      },
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert

    // 1. Error dispatched
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('mutually exclusive'),
        details: expect.objectContaining({
          recipientIds: ['npc:bob'],
          excludedActorIds: ['npc:charlie'],
        }),
      })
    );

    // 2. Event NOT dispatched (only error)
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  test('event payload includes all required fields', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actorId = 'npc:alice';
    const targetId = 'npc:bob';

    const params = {
      location_id: locationId,
      description_text: 'Alice examines the ancient tome.',
      perception_type: 'item.examine',
      actor_id: actorId,
      target_id: targetId,
      involved_entities: ['item:tome'],
      contextual_data: {
        excludedActorIds: [actorId],
      },
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - All payload fields present
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        eventName: 'core:perceptible_event',
        locationId,
        descriptionText: 'Alice examines the ancient tome.',
        perceptionType: 'item.examine',
        actorId,
        targetId,
        involvedEntities: ['item:tome'],
        timestamp: expect.any(String),
        senseAware: true,
        contextualData: expect.objectContaining({
          recipientIds: [],
          excludedActorIds: [actorId],
        }),
      })
    );
  });

  test('edge case: exclude all actors - event still dispatched', async () => {
    // Arrange
    const locationId = 'loc:small_room';

    const params = {
      location_id: locationId,
      description_text: 'Something happens.',
      perception_type: 'state.observable_change',
      actor_id: 'npc:environment',
      contextual_data: {
        excludedActorIds: ['npc:alice', 'npc:bob'], // Exclude everyone
      },
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - Event still dispatched (log creation handled by rule)
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        locationId,
        contextualData: expect.objectContaining({
          excludedActorIds: ['npc:alice', 'npc:bob'],
        }),
      })
    );

    // Debug log shows event was dispatched
    expect(logger.debug).toHaveBeenCalledWith(
      'DISPATCH_PERCEPTIBLE_EVENT: dispatching event',
      expect.objectContaining({
        payload: expect.objectContaining({
          locationId,
        }),
      })
    );
  });

  test('perspective-aware descriptions passed through to event payload', async () => {
    // Arrange
    const params = {
      location_id: 'loc:tavern',
      description_text: 'Alice removes Bob\'s shoes.',
      perception_type: 'physical.target_action',
      actor_id: 'npc:alice',
      target_id: 'npc:bob',
      actor_description: 'I remove Bob\'s shoes.',
      target_description: 'Alice removes my shoes.',
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - Perspective descriptions included in payload
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        actorDescription: 'I remove Bob\'s shoes.',
        targetDescription: 'Alice removes my shoes.',
      })
    );
  });

  test('sense-aware parameters passed through to event payload', async () => {
    // Arrange
    const params = {
      location_id: 'loc:tavern',
      description_text: 'A loud crash echoes through the room.',
      perception_type: 'state.observable_change',
      actor_id: 'npc:environment',
      sense_aware: true,
      alternate_descriptions: {
        hearing: 'You hear a loud crash.',
        sight: null, // Cannot be seen
      },
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert - Sense-aware parameters in payload
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        senseAware: true,
        alternateDescriptions: {
          hearing: 'You hear a loud crash.',
          sight: null,
        },
      })
    );
  });
});
