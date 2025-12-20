/**
 * @file PerceptibleEventLoggingPipeline.e2e.test.js
 * @description E2E coverage for DISPATCH_PERCEPTIBLE_EVENT -> perception log pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json' assert { type: 'json' };

describe('Perceptible Event Logging Pipeline E2E', () => {
  const locationId = 'room1';
  const actorId = 'actor1';
  const targetId = 'actor2';
  let testEnv;

  beforeEach(() => {
    const entities = [
      {
        id: locationId,
        components: {
          'core:name': { name: 'Test Room' },
        },
      },
      {
        id: actorId,
        components: {
          'core:actor': { name: 'Test Actor' },
          'core:position': { locationId },
          'core:perception_log': { logEntries: [], maxEntries: 50 },
        },
      },
      {
        id: targetId,
        components: {
          'core:actor': { name: 'Test Target' },
          'core:position': { locationId },
          'core:perception_log': { logEntries: [], maxEntries: 50 },
        },
      },
    ];

    testEnv = createRuleTestEnvironment({
      createHandlers:
        ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
          ModTestHandlerFactory
        ),
      entities,
      rules: [logPerceptibleEventsRule],
      actions: [],
    });
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('logs a DISPATCH_PERCEPTIBLE_EVENT into perception logs for co-located actors', async () => {
    const description = 'Test actor waves to target.';
    const perceptionType = 'social.interaction';

    await testEnv.operationInterpreter.execute(
      {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: locationId,
          description_text: description,
          perception_type: perceptionType,
          actor_id: actorId,
          target_id: targetId,
        },
      },
      { evaluationContext: {} }
    );

    const dispatchPromise =
      testEnv.eventBus.dispatch.mock.results.at(-1)?.value;
    if (dispatchPromise) {
      await dispatchPromise;
    }

    const perceptibleEvent = testEnv.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload).toMatchObject({
      locationId,
      descriptionText: description,
      perceptionType,
      actorId,
      targetId,
    });

    const actorLog = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    const targetLog = testEnv.entityManager.getComponentData(
      targetId,
      'core:perception_log'
    );

    expect(actorLog?.logEntries?.length).toBe(1);
    expect(targetLog?.logEntries?.length).toBe(1);

    const [actorEntry] = actorLog.logEntries;
    const [targetEntry] = targetLog.logEntries;

    expect(actorEntry).toMatchObject({
      descriptionText: description,
      perceptionType,
      actorId,
      targetId,
    });
    expect(targetEntry).toMatchObject({
      descriptionText: description,
      perceptionType,
      actorId,
      targetId,
    });

    expect(actorEntry.timestamp).toBe(perceptibleEvent.payload.timestamp);
    expect(targetEntry.timestamp).toBe(perceptibleEvent.payload.timestamp);
  });
});
