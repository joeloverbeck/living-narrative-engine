import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import ModTestHandlerFactory from '../../../common/mods/ModTestHandlerFactory.js';
import lockRule from '../../../../data/mods/locks/rules/handle_lock_connection.rule.json' assert { type: 'json' };
import eventIsActionLock from '../../../../data/mods/locks/conditions/event-is-action-lock-connection.condition.json' assert { type: 'json' };
import logSuccessAndEndTurn from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json' assert { type: 'json' };

/**
 *
 * @param root0
 * @param root0.isLocked
 * @param root0.actorInventory
 * @param root0.requiredKeyId
 * @param root0.blockerId
 * @param root0.actorId
 * @param root0.roomId
 */
function buildScenario({
  isLocked = false,
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
    .withComponent('mechanisms:openable', {
      isLocked,
      requiredKeyId,
    })
    .build();

  const key = new ModEntityBuilder(requiredKeyId)
    .withName('Rusty Key')
    .withComponent('items-core:item', {})
    .build();

  const wrongKey = new ModEntityBuilder('items:wrong_key')
    .withName('Wrong Key')
    .withComponent('items-core:item', {})
    .build();

  return {
    room,
    actor,
    blocker,
    key,
    wrongKey,
    requiredKeyId,
    actorId,
    blockerId,
  };
}

describe('locks:lock_connection rule (integration)', () => {
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
      rules: [lockRule],
      conditions: {
        [eventIsActionLock.id]: eventIsActionLock,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessAndEndTurn,
      },
    });
    env.validateAction = () => true;

    console.log('lock rule count', env.dataRegistry.getAllSystemRules().length);

    console.log('listeners', env.eventBus.listenerCount('*'));
  });

  afterEach(() => {
    env?.cleanup?.();
  });

  it('locks the blocker with the matching key and records the actor', async () => {
    const scenario = buildScenario({ isLocked: false });
    env.reset([scenario.room, scenario.actor, scenario.blocker, scenario.key]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:lock_connection',
      targetId: scenario.blockerId,
      secondaryId: scenario.requiredKeyId,
      targets: {
        primary: scenario.blockerId,
        secondary: scenario.requiredKeyId,
      },
      originalInput: 'lock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    console.log('lock events', env.events);

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'mechanisms:openable'
    );
    expect(blocker.isLocked).toBe(true);
    expect(blocker.lastChangedBy).toBe(scenario.actorId);

    const perception = env.events.find(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.perceptionType === 'connection.lock'
    );
    expect(perception).toBeDefined();
    expect(perception.payload.descriptionText).toBe(
      'Riley locks Sealed Door with Rusty Key.'
    );
  });

  it('fails when the blocker is already locked', async () => {
    const scenario = buildScenario({ isLocked: true });
    env.reset([scenario.room, scenario.actor, scenario.blocker, scenario.key]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:lock_connection',
      targetId: scenario.blockerId,
      secondaryId: scenario.requiredKeyId,
      targets: {
        primary: scenario.blockerId,
        secondary: scenario.requiredKeyId,
      },
      originalInput: 'lock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'mechanisms:openable'
    );
    expect(blocker.isLocked).toBe(true);

    const failure = env.events.find(
      (e) =>
        e.eventType === 'core:display_failed_action_result' &&
        e.payload.message?.includes('already locked')
    );
    expect(failure).toBeDefined();
  });

  it('fails when the actor uses the wrong key', async () => {
    const scenario = buildScenario({
      actorInventory: ['items:wrong_key'],
    });
    env.reset([
      scenario.room,
      scenario.actor,
      scenario.blocker,
      scenario.key,
      scenario.wrongKey,
    ]);

    await env.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actorId,
      actionId: 'locks:lock_connection',
      targetId: scenario.blockerId,
      secondaryId: 'items:wrong_key',
      targets: { primary: scenario.blockerId, secondary: 'items:wrong_key' },
      originalInput: 'lock',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blocker = env.entityManager.getComponentData(
      scenario.blockerId,
      'mechanisms:openable'
    );
    expect(blocker.isLocked).toBe(false);

    const failure = env.events.find(
      (e) =>
        e.eventType === 'core:display_failed_action_result' &&
        e.payload.message?.includes('matching key')
    );
    expect(failure).toBeDefined();
  });
});
