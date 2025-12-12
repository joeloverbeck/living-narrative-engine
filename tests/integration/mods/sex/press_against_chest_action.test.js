/**
 * @file Integration tests for the sex-breastplay:press_against_chest action and rule.
 * @description Verifies narration, perceptible event payload, and turn resolution for front-facing breast pressing.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  PRESS_AGAINST_CHEST_ACTION_ID as ACTION_ID,
  PRESS_AGAINST_CHEST_ACTOR_ID as ACTOR_ID,
  PRESS_AGAINST_CHEST_TARGET_ID as TARGET_ID,
  buildPressAgainstChestScenario,
} from '../../../common/mods/sex/pressAgainstChestFixtures.js';
import pressAgainstChestAction from '../../../../data/mods/sex-breastplay/actions/press_against_chest.action.json';

const EXPECTED_MESSAGE =
  "Lyra presses herself against Darius's chest, her breasts getting squeezed between their bodies.";

/**
 * @description Registers the press against chest action with the action index.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pressAgainstChestAction]);
}

describe('sex-breastplay:press_against_chest action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-breastplay',
      ACTION_ID,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('dispatches the front-facing breast press narration and perceptible event', async () => {
    const { entities, actorId, targetId, roomId } =
      buildPressAgainstChestScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, targetId);

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId: actorId,
      targetId: targetId,
      perceptionType: 'physical.target_action',
    });
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Test Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Lyra')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: ACTOR_ID,
    });

    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1);
  });

  it('handles missing target gracefully', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Lyra')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: ACTION_ID,
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
      });
    }).not.toThrow();

    const eventTypes = testFixture.events.map((event) => event.eventType);
    expect(eventTypes).toEqual(['core:attempt_action']);
  });
});
