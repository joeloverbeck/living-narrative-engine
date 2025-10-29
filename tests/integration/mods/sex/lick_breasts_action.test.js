/**
 * @file Integration tests for the sex-breastplay:lick_breasts action and rule.
 * @description Verifies narration, perceptible event payload, and turn resolution for breast licking.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  LICK_BREASTS_ACTION_ID as ACTION_ID,
  NUZZLE_BARE_BREASTS_ACTOR_ID as ACTOR_ID,
  NUZZLE_BARE_BREASTS_TARGET_ID as TARGET_ID,
  buildNuzzleBareBreastsScenario,
  installBareBreastsScopeOverride,
} from '../../../common/mods/sex/nuzzleBareBreastsFixtures.js';
import lickBreastsAction from '../../../../data/mods/sex-breastplay/actions/lick_breasts.action.json';

const EXPECTED_MESSAGE =
  "Selene licks Mira's breasts, Selene's tongue sliding warm and wet over Mira's tit meat.";

/**
 * @description Registers the lick breasts action with the action index.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickBreastsAction]);
}

describe('sex-breastplay:lick_breasts action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-breastplay',
      ACTION_ID,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );

    restoreScopeResolver = installBareBreastsScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('dispatches the breast licking narration and perceptible event', async () => {
    const { entities, actorId, targetId, roomId } =
      buildNuzzleBareBreastsScenario();
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
      perceptionType: 'action_target_general',
    });
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Test Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Selene')
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
        .withName('Selene')
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
