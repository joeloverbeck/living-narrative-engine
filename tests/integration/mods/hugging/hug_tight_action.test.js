/**
 * @file Integration tests for the hugging:hug_tight action and rule.
 * @description Verifies hugging state management, validation guards, and messaging for the hug_tight action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import hugTightRule from '../../../../data/mods/hugging/rules/handle_hug_tight.rule.json';
import eventIsActionHugTight from '../../../../data/mods/hugging/conditions/event-is-action-hug-tight.condition.json';

const ACTION_ID = 'hugging:hug_tight';
const EXPECTED_TEMPLATE =
  '{actor} closes their arms around {target} tenderly, hugging {target} tight.';

describe('hugging:hug_tight action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      ACTION_ID,
      hugTightRule,
      eventIsActionHugTight
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('assigns hugging state and emits matching success and perceptible events', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'observatory',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const expectedMessage = EXPECTED_TEMPLATE.replace(
      '{actor}',
      'Alice'
    ).replaceAll('{target}', 'Bob');

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);

    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      locationId: 'observatory',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: scenario.actor.id,
      consented: true,
    });
  });

  it('prevents repeated hug attempts while the state is active', async () => {
    const scenario = testFixture.createCloseActors(['Iris', 'Julian'], {
      location: 'sunroom',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const initialEventCount = testFixture.events.length;

    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('forbidden component');

    expect(testFixture.events.length).toBe(initialEventCount);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: scenario.actor.id,
      consented: true,
    });
  });

  it('cleans up stale hugging components on both participants before applying new state', async () => {
    const scenario = testFixture.createCloseActors(['Maya', 'Noah'], {
      location: 'studio',
    });

    const stalePartner = new ModEntityBuilder('clara_old_partner')
      .withName('Clara')
      .atLocation('studio')
      .asActor()
      .build();

    stalePartner.components['positioning:being_hugged'] = {
      hugging_entity_id: scenario.actor.id,
      consented: false,
    };

    const previousHugger = new ModEntityBuilder('hugo_previous_hugger')
      .withName('Hugo')
      .atLocation('studio')
      .asActor()
      .build();

    previousHugger.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: false,
    };

    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: stalePartner.id,
      initiated: true,
    };
    scenario.target.components['positioning:being_hugged'] = {
      hugging_entity_id: previousHugger.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('studio', 'Studio');
    testFixture.reset([
      room,
      scenario.actor,
      scenario.target,
      stalePartner,
      previousHugger,
    ]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );
    const stalePartnerInstance = testFixture.entityManager.getEntityInstance(
      stalePartner.id
    );
    const previousHuggerInstance = testFixture.entityManager.getEntityInstance(
      previousHugger.id
    );

    expect(actorInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: scenario.actor.id,
      consented: true,
    });
    expect(stalePartnerInstance).not.toHaveComponent(
      'positioning:being_hugged'
    );
    expect(previousHuggerInstance).not.toHaveComponent('positioning:hugging');
  });

  it('blocks hugging a target who is already being hugged by someone else', async () => {
    const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], {
      location: 'atrium',
    });

    const currentHugger = new ModEntityBuilder('nora_current_hugger')
      .withName('Nora')
      .atLocation('atrium')
      .asActor()
      .build();

    currentHugger.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };

    scenario.target.components['positioning:being_hugged'] = {
      hugging_entity_id: currentHugger.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('atrium', 'Atrium');
    testFixture.reset([room, scenario.actor, scenario.target, currentHugger]);

    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow('forbidden component');

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );
    const currentHuggerInstance = testFixture.entityManager.getEntityInstance(
      currentHugger.id
    );

    expect(actorInstance).not.toHaveComponent('positioning:hugging');
    expect(actorInstance).not.toHaveComponent('positioning:being_hugged');
    expect(targetInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: currentHugger.id,
      consented: true,
    });
    expect(currentHuggerInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
  });

  it('ignores unrelated actions so the hug rule only fires for hugging:hug_tight', async () => {
    const scenario = testFixture.createCloseActors(['Tina', 'Ravi'], {
      location: 'lounge',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'hugging:embrace_casual',
      targetId: scenario.target.id,
      originalInput: 'embrace_casual target',
    });

    const hugEvents = testFixture.events.filter(
      (event) =>
        event.eventType === 'core:perceptible_event' &&
        event.payload.descriptionText ===
          EXPECTED_TEMPLATE.replace('{actor}', 'Tina').replaceAll(
            '{target}',
            'Ravi'
          )
    );
    expect(hugEvents).toHaveLength(0);
  });

  it('keeps success and perceptible messaging aligned for different names', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    const expectedMessage = EXPECTED_TEMPLATE.replace(
      '{actor}',
      'Diana'
    ).replaceAll('{target}', 'Victor');

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });
});
