/**
 * @file Integration tests for the caressing:caress_bare_back action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import caressBareBackRule from '../../../../data/mods/caressing/rules/caress_bare_back.rule.json';
import eventIsActionCaressBareBack from '../../../../data/mods/caressing/conditions/event-is-action-caress-bare-back.condition.json';

const ACTION_ID = 'caressing:caress_bare_back';
const BACK_SOCKETS = ['upper_back', 'lower_back'];

/**
 *
 * @param entity
 */
function ensureBackUncovered(entity) {
  entity.components['clothing:slot_metadata'] = {
    slotMappings: {
      back_accessory: {
        coveredSockets: BACK_SOCKETS,
        allowedLayers: ['accessory', 'armor'],
      },
    },
  };
  delete entity.components['clothing:equipment'];
}

describe('caressing:caress_bare_back action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      ACTION_ID,
      caressBareBackRule,
      eventIsActionCaressBareBack
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('logs matching success and perceptible messages with correct metadata', async () => {
    const scenario = testFixture.createCloseActors(['Lena', 'Iris']);
    ensureBackUncovered(scenario.target);

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const expectedMessage =
      "Lena sensually caresses the bare skin of Iris's back.";
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      expectedMessage,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: expectedMessage,
      locationId: 'room1',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
      perceptionType: 'action_target_general',
    });
  });

  it('does not trigger the rule for other actions', async () => {
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    const actor = ModEntityScenarios.createActorTargetPair({
      names: ['Nova', 'Kai'],
    }).actor;
    actor.components['positioning:closeness'] = { partners: [] };

    testFixture.reset([room, actor]);

    const initialCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: actor.id,
    });

    expect(testFixture.events.length).toBe(initialCount + 1);
  });

  it('rule structure matches the expected caressing pattern', () => {
    expect(testFixture.ruleFile.rule_id).toBe('handle_caress_bare_back');
    expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    expect(testFixture.conditionFile.id).toBe(
      'caressing:event-is-action-caress-bare-back'
    );

    const actions = testFixture.ruleFile.actions;
    const lastAction = actions[actions.length - 1];
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
  });
});
