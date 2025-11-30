import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import ModTestHandlerFactory from '../../../common/mods/ModTestHandlerFactory.js';
import unlockRule from '../../../../data/mods/locks/rules/handle_unlock_connection.rule.json' assert { type: 'json' };
import eventIsActionUnlock from '../../../../data/mods/locks/conditions/event-is-action-unlock-connection.condition.json' assert { type: 'json' };
import logSuccessAndEndTurn from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json' assert { type: 'json' };

function buildScenario({
  isLocked = true,
  actorInventory = ['items:test_key'],
  requiredKeyId = 'items:test_key',
  blockerId = 'locks:test_blocker',
  actorId = 'locks:actor',
  roomId = 'locks:test_room',
} = {}) {
  const room = new ModEntityBuilder(roomId).asRoom('Lock Test Room').build();

  const actor = new ModEntityBuilder(actorId)
    .withName('Riley')
    .asActor()
    .atLocation(roomId)
    .withComponent('items:inventory', {
      items: actorInventory,
      capacity: { maxWeight: 10, maxItems: 5 },
    })
    .build();

  const blocker = new ModEntityBuilder(blockerId)
    .withName('Sealed Door')
    .withComponent('locks:openable', {
      isLocked,
      requiredKeyId,
    })
    .build();

  const key = new ModEntityBuilder(requiredKeyId)
    .withName('Rusty Key')
    .withComponent('items:item', {})
    .build();

  return {
    room,
    actor,
    blocker,
    key,
    requiredKeyId,
    actorId,
    blockerId,
  };
}

describe('locks:unlock_connection rule (integration)', () => {
  let env;

  beforeEach(async () => {
    env = createRuleTestEnvironment({
      createHandlers: (entityManager, eventBus, logger, dataRegistry) =>
        ModTestHandlerFactory.createHandlersWithComponentMutations(
          entityManager,
          eventBus,
          logger,
          dataRegistry
        ),
      rules: [unlockRule],
      conditions: {
        [eventIsActionUnlock.id]: eventIsActionUnlock,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessAndEndTurn,
      },
    });
    env.validateAction = () => true;
  });

  afterEach(() => {
    env?.cleanup?.();
  });

  it('unlocks the blocker with the matching key and records the actor', async () => {
    const scenario = buildScenario();
    env.reset([scenario.room, scenario.actor, scenario.blocker, scenario.key]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:unlock_connection',
      targetId: scenario.blockerId,
      secondaryId: scenario.requiredKeyId,
      targets: { primary: scenario.blockerId, secondary: scenario.requiredKeyId },
      originalInput: 'unlock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'locks:openable'
    );

    expect(blocker.isLocked).toBe(false);
    expect(blocker.lastChangedBy).toBe(scenario.actorId);

    const perception = env.events.find(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.perceptionType === 'connection_unlocked'
    );
    expect(perception).toBeDefined();
  });

  it('fails when the actor lacks the correct key', async () => {
    const scenario = buildScenario({ actorInventory: [] });
    env.reset([scenario.room, scenario.actor, scenario.blocker, scenario.key]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:unlock_connection',
      targetId: scenario.blockerId,
      secondaryId: scenario.requiredKeyId,
      targets: { primary: scenario.blockerId, secondary: scenario.requiredKeyId },
      originalInput: 'unlock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'locks:openable'
    );
    expect(blocker.isLocked).toBe(true);

    const failure = env.events.find(
      (e) =>
        e.eventType === 'core:display_failed_action_result' &&
        e.payload.message?.includes('matching key')
    );
    expect(failure).toBeDefined();
  });

  it('fails gracefully when the blocker is already unlocked', async () => {
    const scenario = buildScenario({ isLocked: false });
    env.reset([scenario.room, scenario.actor, scenario.blocker, scenario.key]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:unlock_connection',
      targetId: scenario.blockerId,
      secondaryId: scenario.requiredKeyId,
      targets: { primary: scenario.blockerId, secondary: scenario.requiredKeyId },
      originalInput: 'unlock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'locks:openable'
    );
    expect(blocker.isLocked).toBe(false);

    const failure = env.events.find(
      (e) =>
        e.eventType === 'core:display_failed_action_result' &&
        e.payload.message?.includes('already unlocked')
    );
    expect(failure).toBeDefined();
  });
});
