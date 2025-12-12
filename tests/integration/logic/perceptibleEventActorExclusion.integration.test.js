/**
 * @jest-environment node
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

const makeEntityManager = () => ({
  getEntitiesInLocation: jest.fn(),
  hasComponent: jest.fn(),
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
  batchAddComponentsOptimized: jest.fn(),
});

describe('Perceptible Event Actor Exclusion - Integration Tests', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let logHandler;
  let dispatchHandler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    entityManager = makeEntityManager();

    logHandler = new AddPerceptionLogEntryHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
    });

    dispatchHandler = new DispatchPerceptibleEventHandler({
      dispatcher,
      logger,
      addPerceptionLogEntryHandler: logHandler,
    });

    jest.clearAllMocks();
  });

  test('end-to-end: actor examines item briefly, excluded from broadcast', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actorId = 'npc:alice';
    const otherActors = ['npc:bob', 'npc:charlie'];

    entityManager.getEntitiesInLocation.mockReturnValue(
      new Set([actorId, ...otherActors])
    );

    // All actors have perception logs
    entityManager.hasComponent.mockReturnValue(true);
    entityManager.getComponentData.mockReturnValue({
      maxEntries: 50,
      logEntries: [],
    });

    entityManager.batchAddComponentsOptimized.mockResolvedValue({
      updateCount: 2,
      errors: [],
    });

    const params = {
      location_id: locationId,
      description_text: 'Alice briefly examines the ancient tome.',
      perception_type: 'item.examine',
      actor_id: actorId,
      contextual_data: {
        excludedActorIds: [actorId], // Alice doesn't see her own brief examination
      },
      log_entry: true,
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert

    // 1. Event dispatched with exclusion data
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

    // 2. Only Bob and Charlie get the log entry (Alice excluded)
    expect(entityManager.getEntitiesInLocation).toHaveBeenCalledWith(
      locationId
    );

    // 3. Batch update called with only Bob and Charlie
    expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          instanceId: 'npc:bob',
          componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
        }),
        expect.objectContaining({
          instanceId: 'npc:charlie',
          componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
        }),
      ]),
      true
    );

    // 4. Alice not in batch update
    const batchSpecs =
      entityManager.batchAddComponentsOptimized.mock.calls[0][0];
    expect(batchSpecs).toHaveLength(2);
    expect(batchSpecs.every((spec) => spec.instanceId !== actorId)).toBe(true);
  });

  test('multiple perceptible events with different exclusions', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actors = ['npc:alice', 'npc:bob', 'npc:charlie', 'npc:dave'];

    entityManager.getEntitiesInLocation.mockReturnValue(new Set(actors));
    entityManager.hasComponent.mockReturnValue(true);
    entityManager.getComponentData.mockReturnValue({
      maxEntries: 50,
      logEntries: [],
    });
    entityManager.batchAddComponentsOptimized.mockResolvedValue({
      updateCount: actors.length,
      errors: [],
    });

    // Act - Event 1: Alice speaks (exclude Alice)
    await dispatchHandler.execute(
      {
        location_id: locationId,
        description_text: 'Alice says hello.',
        perception_type: 'communication.speech',
        actor_id: 'npc:alice',
        contextual_data: { excludedActorIds: ['npc:alice'] },
        log_entry: true,
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
        log_entry: true,
      },
      {}
    );

    // Assert

    // Event 1: Bob, Charlie, Dave get log (Alice excluded)
    const event1Specs =
      entityManager.batchAddComponentsOptimized.mock.calls[0][0];
    expect(event1Specs).toHaveLength(3);
    expect(event1Specs.every((spec) => spec.instanceId !== 'npc:alice')).toBe(
      true
    );
    expect(event1Specs.some((spec) => spec.instanceId === 'npc:bob')).toBe(
      true
    );
    expect(event1Specs.some((spec) => spec.instanceId === 'npc:charlie')).toBe(
      true
    );
    expect(event1Specs.some((spec) => spec.instanceId === 'npc:dave')).toBe(
      true
    );

    // Event 2: Alice, Charlie, Dave get log (Bob excluded)
    const event2Specs =
      entityManager.batchAddComponentsOptimized.mock.calls[1][0];
    expect(event2Specs).toHaveLength(3);
    expect(event2Specs.every((spec) => spec.instanceId !== 'npc:bob')).toBe(
      true
    );
    expect(event2Specs.some((spec) => spec.instanceId === 'npc:alice')).toBe(
      true
    );
    expect(event2Specs.some((spec) => spec.instanceId === 'npc:charlie')).toBe(
      true
    );
    expect(event2Specs.some((spec) => spec.instanceId === 'npc:dave')).toBe(
      true
    );
  });

  test('backward compatibility: events without excludedActorIds work as before', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actors = ['npc:alice', 'npc:bob', 'npc:charlie'];

    entityManager.getEntitiesInLocation.mockReturnValue(new Set(actors));
    entityManager.hasComponent.mockReturnValue(true);
    entityManager.getComponentData.mockReturnValue({
      maxEntries: 50,
      logEntries: [],
    });
    entityManager.batchAddComponentsOptimized.mockResolvedValue({
      updateCount: actors.length,
      errors: [],
    });

    const params = {
      location_id: locationId,
      description_text: 'A mysterious sound echoes.',
      perception_type: 'state.observable_change',
      actor_id: 'npc:environment',
      // No contextual_data at all (backward compatible)
      log_entry: true,
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert

    // 1. Event dispatched with default empty arrays
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        contextualData: expect.objectContaining({
          recipientIds: [],
          excludedActorIds: [],
        }),
      })
    );

    // 2. All actors receive the log entry
    const batchSpecs =
      entityManager.batchAddComponentsOptimized.mock.calls[0][0];
    expect(batchSpecs).toHaveLength(3);
    expect(batchSpecs.map((s) => s.instanceId).sort()).toEqual(actors.sort());
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
      log_entry: true,
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

    // 3. Log handler NOT called
    expect(entityManager.getEntitiesInLocation).not.toHaveBeenCalled();
  });

  test('batch optimization: single event emitted with exclusions', async () => {
    // Arrange
    const locationId = 'loc:tavern';
    const actors = ['npc:alice', 'npc:bob', 'npc:charlie', 'npc:dave'];

    entityManager.getEntitiesInLocation.mockReturnValue(new Set(actors));
    entityManager.hasComponent.mockReturnValue(true);
    entityManager.getComponentData.mockReturnValue({
      maxEntries: 50,
      logEntries: [],
    });

    // Track if batchAddComponentsOptimized was called
    const batchAddSpy = jest.fn().mockResolvedValue({
      updateCount: 3,
      errors: [],
    });
    entityManager.batchAddComponentsOptimized = batchAddSpy;

    const params = {
      location_id: locationId,
      description_text: 'Alice examines the ancient tome in detail.',
      perception_type: 'item.examine',
      actor_id: 'npc:alice',
      contextual_data: {
        excludedActorIds: ['npc:alice'], // Exclude Alice
      },
      log_entry: true,
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert

    // 1. Batch method called exactly once
    expect(batchAddSpy).toHaveBeenCalledTimes(1);

    // 2. Called with emit = true (single batch event)
    expect(batchAddSpy).toHaveBeenCalledWith(
      expect.any(Array),
      true // emit single batch event
    );

    // 3. Only non-excluded actors in batch (Bob, Charlie, Dave)
    const batchSpecs = batchAddSpy.mock.calls[0][0];
    expect(batchSpecs).toHaveLength(3);
    expect(batchSpecs.every((spec) => spec.instanceId !== 'npc:alice')).toBe(
      true
    );

    // 4. Individual addComponent NOT called (batch optimization working)
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('edge case: exclude all actors in location', async () => {
    // Arrange
    const locationId = 'loc:small_room';
    const actors = ['npc:alice', 'npc:bob'];

    entityManager.getEntitiesInLocation.mockReturnValue(new Set(actors));
    entityManager.hasComponent.mockReturnValue(true);

    const params = {
      location_id: locationId,
      description_text: 'Something happens.',
      perception_type: 'state.observable_change',
      actor_id: 'npc:environment',
      contextual_data: {
        excludedActorIds: ['npc:alice', 'npc:bob'], // Exclude everyone
      },
      log_entry: true,
    };

    // Act
    await dispatchHandler.execute(params, {});

    // Assert

    // 1. Event still dispatched
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.any(Object)
    );

    // 2. No batch update (no recipients after exclusion)
    expect(entityManager.batchAddComponentsOptimized).not.toHaveBeenCalled();
    expect(entityManager.addComponent).not.toHaveBeenCalled();

    // 3. Debug log indicates all actors excluded
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('All actors excluded')
    );
  });
});
