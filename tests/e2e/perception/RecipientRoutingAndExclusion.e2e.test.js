/**
 * @file RecipientRoutingAndExclusion.e2e.test.js
 * @description E2E coverage for recipient/exclusion routing in perceptible events.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json' assert { type: 'json' };

describe('Recipient Routing and Exclusion E2E', () => {
  const locationId = 'room1';
  const actorId = 'actor1';
  const recipientId = 'actor2';
  const observerId = 'actor3';
  let testEnv;

  const buildEntities = () => [
    {
      id: locationId,
      components: {
        'core:name': { name: 'Test Room' },
      },
    },
    {
      id: actorId,
      components: {
        'core:actor': { name: 'Origin Actor' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
    {
      id: recipientId,
      components: {
        'core:actor': { name: 'Recipient Actor' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
    {
      id: observerId,
      components: {
        'core:actor': { name: 'Observer Actor' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
  ];

  const awaitDispatches = async (startIndex) => {
    const pending = testEnv.eventBus.dispatch.mock.results
      .slice(startIndex)
      .map((result) => result.value)
      .filter((value) => value && typeof value.then === 'function');
    if (pending.length > 0) {
      await Promise.all(pending);
    }
  };

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers:
        ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
          ModTestHandlerFactory
        ),
      entities: buildEntities(),
      rules: [logPerceptibleEventsRule],
      actions: [],
    });
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('routes explicitly listed recipients only', async () => {
    const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;
    await testEnv.operationInterpreter.execute(
      {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: locationId,
          description_text: 'Explicit recipient test.',
          perception_type: 'social.interaction',
          actor_id: actorId,
          contextual_data: {
            recipientIds: [recipientId],
          },
        },
      },
      { evaluationContext: {} }
    );

    await awaitDispatches(dispatchStart);

    const recipientLog = testEnv.entityManager.getComponentData(
      recipientId,
      'core:perception_log'
    );
    const actorLog = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );

    expect(recipientLog?.logEntries?.length).toBe(1);
    expect(actorLog?.logEntries?.length).toBe(0);
    expect(observerLog?.logEntries?.length).toBe(0);
  });

  it('excludes actors from broadcast delivery', async () => {
    const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;
    await testEnv.operationInterpreter.execute(
      {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: locationId,
          description_text: 'Exclusion list broadcast test.',
          perception_type: 'social.interaction',
          actor_id: actorId,
          contextual_data: {
            excludedActorIds: [recipientId],
          },
        },
      },
      { evaluationContext: {} }
    );

    await awaitDispatches(dispatchStart);

    const recipientLog = testEnv.entityManager.getComponentData(
      recipientId,
      'core:perception_log'
    );
    const actorLog = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );

    expect(recipientLog?.logEntries?.length).toBe(0);
    expect(actorLog?.logEntries?.length).toBe(1);
    expect(observerLog?.logEntries?.length).toBe(1);
  });

  it('aborts dispatch when recipients and exclusions conflict', async () => {
    const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;
    await testEnv.operationInterpreter.execute(
      {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: locationId,
          description_text: 'Conflict test.',
          perception_type: 'social.interaction',
          actor_id: actorId,
          contextual_data: {
            recipientIds: [recipientId],
            excludedActorIds: [observerId],
          },
        },
      },
      { evaluationContext: {} }
    );

    await awaitDispatches(dispatchStart);

    const perceptibleEvent = testEnv.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    const errorEvent = testEnv.events.find(
      (event) => event.eventType === 'core:system_error_occurred'
    );

    expect(perceptibleEvent).toBeUndefined();
    expect(errorEvent).toBeDefined();

    const actorLog = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    const recipientLog = testEnv.entityManager.getComponentData(
      recipientId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );

    expect(actorLog?.logEntries?.length).toBe(0);
    expect(recipientLog?.logEntries?.length).toBe(0);
    expect(observerLog?.logEntries?.length).toBe(0);
  });

  it('aborts log writes when recipients and exclusions conflict (unified routing policy)', async () => {
    await testEnv.operationInterpreter.execute(
      {
        type: 'ADD_PERCEPTION_LOG_ENTRY',
        parameters: {
          location_id: locationId,
          entry: {
            descriptionText: 'Direct log entry.',
            timestamp: new Date().toISOString(),
            perceptionType: 'social.interaction',
            actorId,
            targetId: null,
            involvedEntities: [],
          },
          recipient_ids: [recipientId],
          excluded_actor_ids: [observerId],
        },
      },
      { evaluationContext: {} }
    );

    // Unified routing policy: aborts on conflict (error mode), dispatches error event
    const errorEvent = testEnv.events.find(
      (event) => event.eventType === 'core:system_error_occurred'
    );
    expect(errorEvent).toBeDefined();
    expect(errorEvent.payload.message).toContain(
      'ADD_PERCEPTION_LOG_ENTRY: recipientIds and excludedActorIds are mutually exclusive'
    );

    // No entries should be written when conflict causes abort
    const recipientLog = testEnv.entityManager.getComponentData(
      recipientId,
      'core:perception_log'
    );
    const actorLog = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    const observerLog = testEnv.entityManager.getComponentData(
      observerId,
      'core:perception_log'
    );

    expect(recipientLog?.logEntries?.length).toBe(0);
    expect(actorLog?.logEntries?.length).toBe(0);
    expect(observerLog?.logEntries?.length).toBe(0);
  });
});
